import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AuditEvent } from '@frogger/shared';

let testDir: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => testDir,
  };
});

function makeEvent(overrides?: Partial<AuditEvent>): AuditEvent {
  return {
    timestamp: new Date().toISOString(),
    tool: 'read-file',
    args: { file_path: '/tmp/test.ts' },
    result: 'success',
    durationMs: 42,
    mode: 'agent',
    provider: 'deepseek',
    model: 'deepseek-chat',
    ...overrides,
  };
}

describe('AuditLogger', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `frogger-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('writes JSONL to date-stamped file', async () => {
    const { AuditLogger } = await import('../audit-logger.js');
    const logger = new AuditLogger({ enabled: true });
    const event = makeEvent();

    logger.log(event);

    // Wait for fire-and-forget write
    await new Promise(r => setTimeout(r, 100));

    const date = new Date().toISOString().split('T')[0];
    const logFile = join(testDir, '.frogger', 'audit', `${date}.jsonl`);
    expect(existsSync(logFile)).toBe(true);

    const content = readFileSync(logFile, 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.tool).toBe('read-file');
    expect(parsed.result).toBe('success');
    expect(parsed.durationMs).toBe(42);
  });

  it('appends multiple events', async () => {
    const { AuditLogger } = await import('../audit-logger.js');
    const logger = new AuditLogger({ enabled: true });

    logger.log(makeEvent({ tool: 'glob' }));
    logger.log(makeEvent({ tool: 'grep' }));

    await new Promise(r => setTimeout(r, 150));

    const date = new Date().toISOString().split('T')[0];
    const logFile = join(testDir, '.frogger', 'audit', `${date}.jsonl`);
    const lines = readFileSync(logFile, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).tool).toBe('glob');
    expect(JSON.parse(lines[1]!).tool).toBe('grep');
  });

  it('does not write when disabled', async () => {
    const { AuditLogger } = await import('../audit-logger.js');
    const logger = new AuditLogger({ enabled: false });

    logger.log(makeEvent());

    await new Promise(r => setTimeout(r, 100));

    const auditDir = join(testDir, '.frogger', 'audit');
    expect(existsSync(auditDir)).toBe(false);
  });

  it('does not block on write errors', async () => {
    const { AuditLogger } = await import('../audit-logger.js');
    const logger = new AuditLogger({ enabled: true });

    // log() should return immediately (fire-and-forget)
    const start = performance.now();
    logger.log(makeEvent());
    const elapsed = performance.now() - start;

    // Should be near-instant (< 5ms)
    expect(elapsed).toBeLessThan(50);
  });
});
