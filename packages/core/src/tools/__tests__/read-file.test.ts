import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createReadFileTool } from '../read-file.js';

describe('read-file tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'Hello, World!');
    await fs.writeFile(
      path.join(tmpDir, 'multiline.txt'),
      'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads an existing file', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!({ path: 'hello.txt' }, { toolCallId: '1', messages: [] });
    expect(result).toBe('Hello, World!');
  });

  it('returns error for missing file', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!({ path: 'nope.txt' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('Error:');
  });

  it('rejects path traversal', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!({ path: '../../etc/passwd' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('Error:');
    expect(result).toContain('escapes');
  });

  it('reads with offset only', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'multiline.txt', offset: 3 },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Lines 4-10 of 10:');
    expect(result).toContain('  4\tline4');
    expect(result).toContain('  10\tline10');
    expect(result).not.toContain('line3');
  });

  it('reads with limit only', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'multiline.txt', limit: 3 },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Lines 1-3 of 10:');
    expect(result).toContain('  1\tline1');
    expect(result).toContain('  3\tline3');
    expect(result).not.toContain('line4');
  });

  it('reads with both offset and limit', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'multiline.txt', offset: 2, limit: 4 },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Lines 3-6 of 10:');
    expect(result).toContain('  3\tline3');
    expect(result).toContain('  6\tline6');
    expect(result).not.toContain('line2');
    expect(result).not.toContain('line7');
  });

  it('returns error when offset is beyond file length', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'multiline.txt', offset: 100 },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Error:');
    expect(result).toContain('offset 100 is beyond the end of the file');
  });

  it('returns full content without offset/limit (unchanged behavior)', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'multiline.txt' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toBe(
      'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10',
    );
  });

  it('shows hint to use glob on ENOENT', async () => {
    const t = createReadFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'does-not-exist.txt' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Error:');
    expect(result).toContain('Hint: Use glob to search for files matching this name pattern.');
  });
});
