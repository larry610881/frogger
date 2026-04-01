import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, AUDIT_DIR } from '@frogger/shared';
import type { AuditEvent, AuditConfig } from '@frogger/shared';
import { logger } from '../utils/logger.js';

function getAuditDir(): string {
  return join(homedir(), CONFIG_DIR, AUDIT_DIR);
}

function getLogFileName(): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${date}.jsonl`;
}

export class AuditLogger {
  private readonly config: AuditConfig;
  private dirEnsured = false;

  constructor(config: AuditConfig) {
    this.config = config;
  }

  /**
   * Log an audit event. Fire-and-forget — never blocks tool execution.
   */
  log(event: AuditEvent): void {
    if (!this.config.enabled) return;

    // Fire-and-forget: don't await, catch errors silently
    this.writeLocal(event).catch(err => {
      logger.warn(`Audit write failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    if (this.config.endpoint) {
      this.postRemote(event).catch(err => {
        logger.warn(`Audit POST failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }

  private async ensureDir(): Promise<void> {
    if (this.dirEnsured) return;
    await mkdir(getAuditDir(), { recursive: true });
    this.dirEnsured = true;
  }

  private async writeLocal(event: AuditEvent): Promise<void> {
    await this.ensureDir();
    const filePath = join(getAuditDir(), getLogFileName());
    const line = JSON.stringify(event) + '\n';
    await appendFile(filePath, line, 'utf-8');
  }

  private async postRemote(event: AuditEvent): Promise<void> {
    const endpoint = this.config.endpoint!;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        logger.warn(`Audit endpoint returned ${response.status}`);
      }
    } catch {
      // Network errors are non-critical for audit
    }
  }
}
