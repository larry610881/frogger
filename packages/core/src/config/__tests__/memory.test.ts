import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let testDir: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => testDir,
  };
});

describe('loadMemory', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `frogger-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns undefined when MEMORY.md does not exist', async () => {
    const { loadMemory } = await import('../memory.js');
    const result = loadMemory();
    expect(result).toBeUndefined();
  });

  it('returns undefined when MEMORY.md is empty', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, 'MEMORY.md'), '', 'utf-8');

    const { loadMemory } = await import('../memory.js');
    const result = loadMemory();
    expect(result).toBeUndefined();
  });

  it('returns content when MEMORY.md has content', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, 'MEMORY.md'), '# My Memory\n\nSome notes.', 'utf-8');

    const { loadMemory } = await import('../memory.js');
    const result = loadMemory();
    expect(result).toBe('# My Memory\n\nSome notes.');
  });
});
