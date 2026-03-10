import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createListFilesTool } from '../list-files.js';

describe('list-files tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
    await fs.mkdir(path.join(tmpDir, 'subdir'));
    await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'hello');
    await fs.writeFile(path.join(tmpDir, 'subdir', 'file2.txt'), 'world');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists files in working directory', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({}, { toolCallId: '1', messages: [] });
    expect(result).toContain('[FILE] file1.txt');
    expect(result).toContain('[DIR]  subdir');
  });

  it('lists files in subdirectory', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ path: 'subdir' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('file2.txt');
  });

  it('lists files recursively', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ recursive: true }, { toolCallId: '1', messages: [] });
    expect(result).toContain('file1.txt');
    expect(result).toContain('file2.txt');
  });

  it('rejects path traversal', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ path: '../../' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('Error:');
    expect(result).toContain('escapes');
  });

  it('rejects absolute path outside boundary', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ path: '/etc' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('Error:');
    expect(result).toContain('escapes');
  });

  it('handles non-existent directory', async () => {
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ path: 'nonexistent' }, { toolCallId: '1', messages: [] });
    expect(result).toContain('Error:');
  });

  it('handles empty directory', async () => {
    await fs.mkdir(path.join(tmpDir, 'empty'));
    const t = createListFilesTool(tmpDir);
    const result = await t.execute!({ path: 'empty' }, { toolCallId: '1', messages: [] });
    expect(result).toBe('(empty directory)');
  });
});
