import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MAX_MEMORY_SIZE } from '@frogger/shared';

let testDir: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => testDir,
  };
});

describe('createSaveMemoryTool', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `frogger-save-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('creates new MEMORY.md when none exists', async () => {
    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    const result = await tool.execute({ content: 'Remember this' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    const memoryFile = join(testDir, '.frogger', 'memory', 'MEMORY.md');
    expect(existsSync(memoryFile)).toBe(true);
    const content = readFileSync(memoryFile, 'utf-8');
    expect(content).toContain('# Frogger Memory');
    expect(content).toContain('Remember this');
    expect(result).toContain('Memory saved to');
  });

  it('appends to existing MEMORY.md', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, 'MEMORY.md'), '# Frogger Memory\n\nExisting content', 'utf-8');

    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    await tool.execute({ content: 'New note' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    const content = readFileSync(join(memoryDir, 'MEMORY.md'), 'utf-8');
    expect(content).toContain('Existing content');
    expect(content).toContain('New note');
    expect(content).toContain('---');
  });

  it('creates memory directory automatically', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    expect(existsSync(memoryDir)).toBe(false);

    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    await tool.execute({ content: 'Auto-create dir' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    expect(existsSync(memoryDir)).toBe(true);
  });

  it('returns confirmation message', async () => {
    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    const result = await tool.execute({ content: 'Test' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    expect(result).toContain('Memory saved to');
    expect(result).toContain('MEMORY.md');
  });

  it('truncates oldest entries when exceeding MAX_MEMORY_SIZE', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });

    // Create a memory file near the limit with multiple entries
    const entrySize = Math.floor(MAX_MEMORY_SIZE / 3);
    const oldEntry1 = `\n\n---\n\n_Saved: 2024-01-01_\n\n${'A'.repeat(entrySize)}`;
    const oldEntry2 = `\n\n---\n\n_Saved: 2024-02-01_\n\n${'B'.repeat(entrySize)}`;
    const existingContent = `# Frogger Memory${oldEntry1}${oldEntry2}`;
    writeFileSync(join(memoryDir, 'MEMORY.md'), existingContent, 'utf-8');

    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    const newContent = 'C'.repeat(entrySize);
    const result = await tool.execute({ content: newContent }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    const finalContent = readFileSync(join(memoryDir, 'MEMORY.md'), 'utf-8');
    // Should have truncated the oldest entry to fit
    expect(finalContent).toContain('# Frogger Memory');
    expect(finalContent).toContain(newContent);
    expect(finalContent.length).toBeLessThanOrEqual(MAX_MEMORY_SIZE);
    expect(result).toContain('truncated');
  });

  it('saves normally when under MAX_MEMORY_SIZE', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, 'MEMORY.md'), '# Frogger Memory\n\nSmall content', 'utf-8');

    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    const result = await tool.execute({ content: 'Another small note' }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    const content = readFileSync(join(memoryDir, 'MEMORY.md'), 'utf-8');
    expect(content).toContain('Small content');
    expect(content).toContain('Another small note');
    expect(result).toContain('Memory saved to');
    expect(result).not.toContain('truncated');
  });

  it('preserves header and newest entries when truncating', async () => {
    const memoryDir = join(testDir, '.frogger', 'memory');
    mkdirSync(memoryDir, { recursive: true });

    // Fill with entries that will force truncation
    const entrySize = Math.floor(MAX_MEMORY_SIZE / 4);
    const entry1 = `\n\n---\n\n_Saved: 2024-01-01_\n\n${'OLD1-'.repeat(Math.floor(entrySize / 5))}`;
    const entry2 = `\n\n---\n\n_Saved: 2024-06-01_\n\n${'OLD2-'.repeat(Math.floor(entrySize / 5))}`;
    const entry3 = `\n\n---\n\n_Saved: 2024-12-01_\n\n${'RECENT-'.repeat(Math.floor(entrySize / 7))}`;
    const existingContent = `# Frogger Memory${entry1}${entry2}${entry3}`;
    writeFileSync(join(memoryDir, 'MEMORY.md'), existingContent, 'utf-8');

    const { createSaveMemoryTool } = await import('../save-memory.js');
    const tool = createSaveMemoryTool();
    const newContent = 'NEW-'.repeat(Math.floor(entrySize / 4));
    await tool.execute({ content: newContent }, { toolCallId: 'test', messages: [], abortSignal: undefined as any });

    const finalContent = readFileSync(join(memoryDir, 'MEMORY.md'), 'utf-8');
    // Header must be preserved
    expect(finalContent).toContain('# Frogger Memory');
    // New content must be present
    expect(finalContent).toContain(newContent);
    // Oldest entries should be removed first
    // At minimum, OLD1 should have been removed before OLD2 or RECENT
    if (!finalContent.includes('OLD2-')) {
      // If OLD2 was also removed, OLD1 must not be there either
      expect(finalContent).not.toContain('OLD1-');
    }
  });
});
