import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import type { ModelMessage } from 'ai';
import { CONFIG_DIR } from '@frogger/shared';
import { logger } from '../utils/logger.js';

const SESSIONS_DIR = path.join(os.homedir(), CONFIG_DIR, 'sessions');

export interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  workingDirectory: string;
  provider: string;
  model: string;
  messages: ModelMessage[];
  totalTokens: number;
}

export class SessionManager {
  private async ensureDir(): Promise<void> {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }

  private generateId(workingDirectory: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(workingDirectory).digest('hex').slice(0, 6);
    return `${timestamp}-${hash}`;
  }

  async save(options: {
    workingDirectory: string;
    provider: string;
    model: string;
    messages: ModelMessage[];
    totalTokens: number;
    existingId?: string;
  }): Promise<string> {
    await this.ensureDir();

    const id = options.existingId ?? this.generateId(options.workingDirectory);
    const now = new Date().toISOString();

    const session: SessionData = {
      id,
      createdAt: options.existingId ? (await this.load(id))?.createdAt ?? now : now,
      updatedAt: now,
      workingDirectory: options.workingDirectory,
      provider: options.provider,
      model: options.model,
      messages: options.messages,
      totalTokens: options.totalTokens,
    };

    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
    logger.debug(`Session saved: ${id}`);

    // Fire-and-forget cleanup — must never block save or crash the app
    this.cleanup().catch((e) => logger.warn(`Session cleanup failed: ${e instanceof Error ? e.message : e}`));

    return id;
  }

  async load(id: string): Promise<SessionData | null> {
    try {
      const filePath = path.join(SESSIONS_DIR, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      logger.debug(`Session loaded: ${id}`);
      return JSON.parse(content) as SessionData;
    } catch {
      return null;
    }
  }

  async list(limit = 10): Promise<SessionData[]> {
    await this.ensureDir();

    try {
      const files = await fs.readdir(SESSIONS_DIR);
      const jsonFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      const sessions: SessionData[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
          sessions.push(JSON.parse(content) as SessionData);
        } catch {
          // Skip corrupt files
        }
      }
      return sessions;
    } catch {
      return [];
    }
  }

  async getLatest(): Promise<SessionData | null> {
    const sessions = await this.list(1);
    return sessions[0] ?? null;
  }

  async getLatestForDirectory(workingDirectory: string): Promise<SessionData | null> {
    await this.ensureDir();

    try {
      const files = await fs.readdir(SESSIONS_DIR);
      const jsonFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
          const session = JSON.parse(content) as SessionData;
          if (session.workingDirectory === workingDirectory) {
            return session;
          }
        } catch {
          // Skip corrupt files
        }
      }
    } catch {
      // Directory read failure
    }
    return null;
  }

  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(path.join(SESSIONS_DIR, `${id}.json`));
    } catch {
      // Ignore if already deleted
    }
  }

  async cleanup(options?: { maxCount?: number; maxAgeDays?: number }): Promise<void> {
    const maxCount = options?.maxCount ?? 100;
    const maxAgeDays = options?.maxAgeDays ?? 30;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    try {
      await this.ensureDir();

      const files = await fs.readdir(SESSIONS_DIR);
      const jsonFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse(); // newest first (IDs are timestamp-based)

      const toDelete: string[] = [];

      for (let i = 0; i < jsonFiles.length; i++) {
        const file = jsonFiles[i]!;
        const filePath = path.join(SESSIONS_DIR, file);

        // Exceeds maxCount — mark for deletion regardless of age
        if (i >= maxCount) {
          toDelete.push(filePath);
          continue;
        }

        // Within count limit — check age
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content) as SessionData;
          const createdAt = new Date(session.createdAt).getTime();
          if (createdAt < cutoff) {
            toDelete.push(filePath);
          }
        } catch {
          // Skip corrupt files — don't delete them, don't crash
        }
      }

      // Delete marked files
      for (const filePath of toDelete) {
        try {
          await fs.unlink(filePath);
        } catch {
          // Ignore individual delete failures
        }
      }

      if (toDelete.length > 0) {
        logger.debug(`Session cleanup: removed ${toDelete.length} session(s)`);
      }
    } catch {
      // Cleanup failure must never crash the app
      logger.debug('Session cleanup failed (non-critical)');
    }
  }
}
