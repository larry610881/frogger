import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CheckpointManager } from '../checkpoint.js';

describe('CheckpointManager', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'checkpoint-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates checkpoint for write-file', async () => {
    // Create a file that will be snapshotted
    const filePath = 'test.txt';
    await fs.writeFile(path.join(tmpDir, filePath), 'original content', 'utf-8');

    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'write-file',
      { path: filePath },
      0,
    );

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.id).toBe(1);
    expect(checkpoint!.toolName).toBe('write-file');
    expect(checkpoint!.messageIndex).toBe(0);
    expect(checkpoint!.fileSnapshots).toHaveLength(1);
    expect(checkpoint!.fileSnapshots[0]!.path).toBe(filePath);
    expect(checkpoint!.fileSnapshots[0]!.content).toBe('original content');
    expect(checkpoint!.createdFiles).toHaveLength(0);
  });

  it('skips non-mutating tools', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'read-file',
      { path: 'test.txt' },
      0,
    );

    expect(checkpoint).toBeNull();
    expect(manager.getCheckpoints()).toHaveLength(0);
  });

  it('restores checkpoint', async () => {
    const filePath = 'test.txt';
    const originalContent = 'original content';
    const modifiedContent = 'modified content';

    // Write original file
    await fs.writeFile(path.join(tmpDir, filePath), originalContent, 'utf-8');

    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    // Create checkpoint before modification
    const checkpoint = await manager.createCheckpoint(
      'write-file',
      { path: filePath },
      0,
    );
    expect(checkpoint).not.toBeNull();

    // Simulate tool execution: overwrite the file
    await fs.writeFile(path.join(tmpDir, filePath), modifiedContent, 'utf-8');

    // Verify file was modified
    const afterModify = await fs.readFile(path.join(tmpDir, filePath), 'utf-8');
    expect(afterModify).toBe(modifiedContent);

    // Restore checkpoint
    const result = await manager.restoreCheckpoint(checkpoint!.id);

    expect(result.messageIndex).toBe(0);
    expect(result.restoredFiles).toContain(filePath);

    // Verify file is restored
    const restored = await fs.readFile(path.join(tmpDir, filePath), 'utf-8');
    expect(restored).toBe(originalContent);
  });

  it('deletes files created after checkpoint', async () => {
    const filePath = 'new-file.txt';

    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    // Create first checkpoint - file doesn't exist yet
    const cp1 = await manager.createCheckpoint(
      'write-file',
      { path: filePath },
      0,
    );
    expect(cp1).not.toBeNull();
    expect(cp1!.createdFiles).toContain(filePath);

    // Simulate: the tool creates the file
    await fs.writeFile(path.join(tmpDir, filePath), 'new file content', 'utf-8');

    // Create second checkpoint for another write
    const cp2 = await manager.createCheckpoint(
      'write-file',
      { path: 'another-file.txt' },
      1,
    );
    expect(cp2).not.toBeNull();

    // Simulate: create another file
    await fs.writeFile(path.join(tmpDir, 'another-file.txt'), 'another content', 'utf-8');

    // Restore to first checkpoint - file created by cp1 should be deleted (snapshot content is null),
    // and file created after cp1 (another-file.txt from cp2) should also be deleted
    const result = await manager.restoreCheckpoint(cp1!.id);

    expect(result.deletedFiles).toContain(filePath);
    expect(result.deletedFiles).toContain('another-file.txt');

    // Verify files are actually deleted
    await expect(fs.access(path.join(tmpDir, filePath))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'another-file.txt'))).rejects.toThrow();
  });

  it('respects maxCheckpoints', async () => {
    const manager = new CheckpointManager({
      workingDirectory: tmpDir,
      isGitRepo: false,
      maxCheckpoints: 3,
    });

    // Create 5 checkpoints
    for (let i = 0; i < 5; i++) {
      await manager.createCheckpoint('bash', { command: `echo ${i}` }, i);
    }

    const checkpoints = manager.getCheckpoints();
    expect(checkpoints).toHaveLength(3);
    // Should keep the most recent 3 (ids 3, 4, 5)
    expect(checkpoints[0]!.id).toBe(3);
    expect(checkpoints[1]!.id).toBe(4);
    expect(checkpoints[2]!.id).toBe(5);
  });

  it('detects git repo', async () => {
    // tmpDir is not a git repo
    const result = await CheckpointManager.detectGitRepo(tmpDir);
    expect(result).toBe(false);
  });

  it('handles missing checkpoint id', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    await expect(manager.restoreCheckpoint(999)).rejects.toThrow('Checkpoint #999 not found');
  });

  it('evicts oldest checkpoints when total snapshot bytes exceed memory limit', async () => {
    // Use a small memory limit for testing (3000 bytes)
    const manager = new CheckpointManager({
      workingDirectory: tmpDir,
      isGitRepo: false,
      maxCheckpoints: 100,
      maxTotalSnapshotBytes: 3000,
    });

    // Create 3 files of ~1500 bytes each (total 4500 > 3000 limit)
    for (let i = 0; i < 3; i++) {
      const filename = `file-${i}.txt`;
      const content = 'x'.repeat(1500);
      await fs.writeFile(path.join(tmpDir, filename), content, 'utf-8');
      await manager.createCheckpoint('write-file', { path: filename }, i);
    }

    const checkpoints = manager.getCheckpoints();
    // Should have evicted the oldest checkpoint(s) to stay under 3000 bytes
    expect(checkpoints.length).toBeLessThan(3);
    // Remaining checkpoints should be the most recent ones
    expect(checkpoints[checkpoints.length - 1]!.id).toBe(3);
  });

  it('creates checkpoint for edit-file tool', async () => {
    const filePath = 'edit-target.txt';
    await fs.writeFile(path.join(tmpDir, filePath), 'before edit', 'utf-8');

    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'edit-file',
      { path: filePath, search: 'before', replace: 'after' },
      0,
    );

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.toolName).toBe('edit-file');
    expect(checkpoint!.fileSnapshots).toHaveLength(1);
    expect(checkpoint!.fileSnapshots[0]!.path).toBe(filePath);
    expect(checkpoint!.fileSnapshots[0]!.content).toBe('before edit');
  });

  it('creates checkpoint for bash tool in non-git repo (empty fileSnapshots)', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'bash',
      { command: 'echo hello' },
      0,
    );

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.toolName).toBe('bash');
    // bash in non-git repo doesn't snapshot dirty files
    expect(checkpoint!.fileSnapshots).toHaveLength(0);
  });

  it('creates checkpoint for git-commit tool', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'git-commit',
      { message: 'test commit' },
      0,
    );

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.toolName).toBe('git-commit');
    // git-commit: no file snapshots, just gitHead (which is undefined for non-git)
    expect(checkpoint!.fileSnapshots).toHaveLength(0);
  });

  it('snapshots new file as null content for write-file on non-existent file', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'write-file',
      { path: 'brand-new-file.txt' },
      0,
    );

    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.fileSnapshots).toHaveLength(1);
    expect(checkpoint!.fileSnapshots[0]!.content).toBeNull();
    expect(checkpoint!.createdFiles).toContain('brand-new-file.txt');
  });

  it('skips files larger than MAX_FILE_SIZE (1MB)', async () => {
    const filePath = 'large-file.txt';
    // Create a file > 1MB
    const largeContent = 'x'.repeat(1_000_001);
    await fs.writeFile(path.join(tmpDir, filePath), largeContent, 'utf-8');

    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    const checkpoint = await manager.createCheckpoint(
      'write-file',
      { path: filePath },
      0,
    );

    expect(checkpoint).not.toBeNull();
    // Large file should be skipped — no snapshot captured
    expect(checkpoint!.fileSnapshots).toHaveLength(0);
  });

  it('getCheckpoint returns specific checkpoint by id', async () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    await manager.createCheckpoint('bash', { command: 'echo 1' }, 0);
    await manager.createCheckpoint('bash', { command: 'echo 2' }, 1);
    const cp3 = await manager.createCheckpoint('bash', { command: 'echo 3' }, 2);

    const found = manager.getCheckpoint(cp3!.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(cp3!.id);
    expect(found!.toolArgs).toEqual({ command: 'echo 3' });
  });

  it('getCheckpoint returns undefined for non-existent id', () => {
    const manager = new CheckpointManager({ workingDirectory: tmpDir, isGitRepo: false });

    expect(manager.getCheckpoint(999)).toBeUndefined();
  });

  it('resets totalSnapshotBytes on clear()', async () => {
    const manager = new CheckpointManager({
      workingDirectory: tmpDir,
      isGitRepo: false,
    });

    const content = 'hello world';
    await fs.writeFile(path.join(tmpDir, 'test.txt'), content, 'utf-8');
    await manager.createCheckpoint('write-file', { path: 'test.txt' }, 0);

    expect(manager.getCheckpoints()).toHaveLength(1);

    manager.clear();
    expect(manager.getCheckpoints()).toHaveLength(0);

    // After clear, should be able to create new checkpoints (bytes counter reset)
    await fs.writeFile(path.join(tmpDir, 'test2.txt'), content, 'utf-8');
    await manager.createCheckpoint('write-file', { path: 'test2.txt' }, 0);
    expect(manager.getCheckpoints()).toHaveLength(1);
  });
});
