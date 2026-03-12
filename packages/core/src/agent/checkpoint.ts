import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export interface FileSnapshot {
  path: string;         // Relative path from workingDirectory
  content: string | null;  // null means file didn't exist (was created after checkpoint)
}

export interface Checkpoint {
  id: number;
  toolName: string;
  toolArgs: Record<string, unknown>;
  messageIndex: number;   // Index into messages array when checkpoint was created
  timestamp: number;
  gitHead?: string;       // HEAD hash at time of checkpoint (git repos only)
  fileSnapshots: FileSnapshot[];
  createdFiles: string[]; // Files that will be created by this tool execution
}

export interface RestoreResult {
  messageIndex: number;
  restoredFiles: string[];
  deletedFiles: string[];
}

const MAX_FILE_SIZE = 1_000_000; // 1MB - skip snapshots for files larger than this
const MAX_TOTAL_SNAPSHOT_BYTES = 50_000_000; // 50MB total snapshot memory limit
const MUTATING_TOOLS = ['write-file', 'edit-file', 'bash', 'git-commit'];

export class CheckpointManager {
  private checkpoints: Checkpoint[] = [];
  private nextId = 1;
  private workingDirectory: string;
  private isGitRepo: boolean;
  private maxCheckpoints: number;
  private maxTotalSnapshotBytes: number;
  private totalSnapshotBytes = 0;

  constructor(options: { workingDirectory: string; isGitRepo: boolean; maxCheckpoints?: number; maxTotalSnapshotBytes?: number }) {
    this.workingDirectory = options.workingDirectory;
    this.isGitRepo = options.isGitRepo;
    this.maxCheckpoints = options.maxCheckpoints ?? 50;
    this.maxTotalSnapshotBytes = options.maxTotalSnapshotBytes ?? MAX_TOTAL_SNAPSHOT_BYTES;
  }

  async createCheckpoint(toolName: string, toolArgs: Record<string, unknown>, messageIndex: number): Promise<Checkpoint | null> {
    // Only create checkpoints for mutating tools
    if (!MUTATING_TOOLS.includes(toolName)) return null;

    const checkpoint: Checkpoint = {
      id: this.nextId++,
      toolName,
      toolArgs,
      messageIndex,
      timestamp: Date.now(),
      fileSnapshots: [],
      createdFiles: [],
    };

    // Record git HEAD if in git repo
    if (this.isGitRepo) {
      try {
        const result = await execa('git', ['rev-parse', 'HEAD'], { cwd: this.workingDirectory, reject: false });
        if (result.exitCode === 0) {
          checkpoint.gitHead = result.stdout.trim();
        }
      } catch { /* ignore */ }
    }

    // Snapshot files based on tool type
    if (toolName === 'write-file' || toolName === 'edit-file') {
      const filePath = toolArgs.path as string | undefined;
      if (filePath) {
        const snapshot = await this.snapshotFile(filePath);
        if (snapshot) {
          checkpoint.fileSnapshots.push(snapshot);
          if (snapshot.content === null) {
            // File doesn't exist yet - will be created
            checkpoint.createdFiles.push(filePath);
          }
        }
      }
    } else if (toolName === 'bash' && this.isGitRepo) {
      // For bash in git repos, snapshot all dirty files
      try {
        const result = await execa('git', ['status', '--porcelain'], { cwd: this.workingDirectory, reject: false });
        if (result.exitCode === 0 && result.stdout.trim()) {
          const lines = result.stdout.trim().split('\n');
          for (const line of lines) {
            const filePath = line.slice(3).trim();
            if (filePath) {
              const snapshot = await this.snapshotFile(filePath);
              if (snapshot) {
                checkpoint.fileSnapshots.push(snapshot);
              }
            }
          }
        }
      } catch { /* ignore */ }
    }
    // git-commit: no file snapshots needed, just gitHead is sufficient

    // Accumulate snapshot bytes
    for (const s of checkpoint.fileSnapshots) {
      if (s.content) this.totalSnapshotBytes += Buffer.byteLength(s.content, 'utf-8');
    }

    this.checkpoints.push(checkpoint);

    // Trim old checkpoints if over count limit
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints = this.checkpoints.slice(-this.maxCheckpoints);
    }

    // Evict oldest checkpoints if over memory limit
    while (this.totalSnapshotBytes > this.maxTotalSnapshotBytes && this.checkpoints.length > 1) {
      const oldest = this.checkpoints.shift()!;
      for (const s of oldest.fileSnapshots) {
        if (s.content) this.totalSnapshotBytes -= Buffer.byteLength(s.content, 'utf-8');
      }
    }

    return checkpoint;
  }

  async restoreCheckpoint(id: number): Promise<RestoreResult> {
    const idx = this.checkpoints.findIndex(cp => cp.id === id);
    if (idx === -1) {
      throw new Error(`Checkpoint #${id} not found`);
    }

    const target = this.checkpoints[idx]!;
    const restoredFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Collect all files created by checkpoints AFTER the target
    const laterCheckpoints = this.checkpoints.slice(idx + 1);
    const filesToDelete = new Set<string>();
    for (const cp of laterCheckpoints) {
      for (const f of cp.createdFiles) {
        filesToDelete.add(f);
      }
    }

    // Restore file snapshots from the target checkpoint
    for (const snapshot of target.fileSnapshots) {
      const resolved = path.resolve(this.workingDirectory, snapshot.path);
      try {
        if (snapshot.content === null) {
          // File didn't exist before - delete it
          await fs.unlink(resolved).catch((e) => logger.warn(`Checkpoint cleanup: ${e instanceof Error ? e.message : e}`));
          deletedFiles.push(snapshot.path);
        } else {
          await fs.writeFile(resolved, snapshot.content, 'utf-8');
          restoredFiles.push(snapshot.path);
        }
      } catch { /* ignore */ }
    }

    // Delete files created by later checkpoints (that aren't in target snapshots)
    for (const filePath of filesToDelete) {
      if (!target.fileSnapshots.some(s => s.path === filePath)) {
        const resolved = path.resolve(this.workingDirectory, filePath);
        try {
          await fs.unlink(resolved);
          deletedFiles.push(filePath);
        } catch { /* ignore - file may not exist */ }
      }
    }

    // Git: if HEAD has moved, reset to recorded HEAD
    if (this.isGitRepo && target.gitHead) {
      try {
        const currentHead = await execa('git', ['rev-parse', 'HEAD'], { cwd: this.workingDirectory, reject: false });
        if (currentHead.exitCode === 0 && currentHead.stdout.trim() !== target.gitHead) {
          await execa('git', ['reset', '--soft', target.gitHead], { cwd: this.workingDirectory, reject: false });
        }
      } catch { /* ignore */ }
    }

    // Remove all checkpoints after the target
    this.checkpoints = this.checkpoints.slice(0, idx);

    return {
      messageIndex: target.messageIndex,
      restoredFiles,
      deletedFiles,
    };
  }

  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  getCheckpoint(id: number): Checkpoint | undefined {
    return this.checkpoints.find(cp => cp.id === id);
  }

  clear(): void {
    this.checkpoints = [];
    this.nextId = 1;
    this.totalSnapshotBytes = 0;
  }

  static async detectGitRepo(workingDirectory: string): Promise<boolean> {
    try {
      const result = await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: workingDirectory, reject: false });
      return result.exitCode === 0 && result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  private async snapshotFile(filePath: string): Promise<FileSnapshot | null> {
    const resolved = path.resolve(this.workingDirectory, filePath);
    try {
      const stat = await fs.stat(resolved);
      if (stat.size > MAX_FILE_SIZE) {
        return null; // Skip large files
      }
      const content = await fs.readFile(resolved, 'utf-8');
      return { path: filePath, content };
    } catch {
      // File doesn't exist yet
      return { path: filePath, content: null };
    }
  }
}
