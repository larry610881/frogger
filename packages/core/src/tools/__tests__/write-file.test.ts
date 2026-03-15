import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWriteFileTool, writeFileMetadata } from '../write-file.js';

const toolCtx = { toolCallId: '1', messages: [] };

describe('write-file tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-write-file-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct metadata', () => {
    expect(writeFileMetadata.name).toBe('write-file');
    expect(writeFileMetadata.permissionLevel).toBe('confirm');
  });

  it('creates a new file', async () => {
    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: 'test.txt', content: 'hello world' }, toolCtx);

    expect(result).toContain('File written: test.txt');
    const content = await fs.readFile(path.join(tmpDir, 'test.txt'), 'utf-8');
    expect(content).toBe('hello world');
  });

  it('creates parent directories automatically', async () => {
    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: 'a/b/c/file.txt', content: 'nested' }, toolCtx);

    expect(result).toContain('File written');
    const content = await fs.readFile(path.join(tmpDir, 'a', 'b', 'c', 'file.txt'), 'utf-8');
    expect(content).toBe('nested');
  });

  it('overwrites existing file and shows diff', async () => {
    const filePath = path.join(tmpDir, 'existing.txt');
    await fs.writeFile(filePath, 'old content\n', 'utf-8');

    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: 'existing.txt', content: 'new content\n' }, toolCtx);

    expect(result).toContain('File written: existing.txt');
    expect(result).toContain('diff');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('new content\n');
  });

  it('no diff shown when writing identical content', async () => {
    const filePath = path.join(tmpDir, 'same.txt');
    await fs.writeFile(filePath, 'same content', 'utf-8');

    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: 'same.txt', content: 'same content' }, toolCtx);

    expect(result).toBe('File written: same.txt');
    expect(result).not.toContain('diff');
  });

  it('rejects path traversal outside working directory', async () => {
    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: '../../etc/passwd', content: 'hack' }, toolCtx);

    expect(result).toContain('Error');
  });

  it('handles empty content', async () => {
    const t = createWriteFileTool(tmpDir);
    const result = await t.execute!({ path: 'empty.txt', content: '' }, toolCtx);

    expect(result).toContain('File written');
    const content = await fs.readFile(path.join(tmpDir, 'empty.txt'), 'utf-8');
    expect(content).toBe('');
  });

  it('uses atomic write via temp file and rename', async () => {
    const writeSpy = vi.spyOn(fs, 'writeFile');
    const renameSpy = vi.spyOn(fs, 'rename');

    const t = createWriteFileTool(tmpDir);
    await t.execute!({ path: 'atomic.txt', content: 'atomic content' }, toolCtx);

    // writeFile should be called with a temp path (contains .frogger-tmp-)
    const writeCall = writeSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('.frogger-tmp-'),
    );
    expect(writeCall).toBeDefined();

    // rename should be called to move temp file to final path
    const renameCall = renameSpy.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('.frogger-tmp-') &&
        call[1] === path.join(tmpDir, 'atomic.txt'),
    );
    expect(renameCall).toBeDefined();

    // Final file should exist with correct content
    const content = await fs.readFile(path.join(tmpDir, 'atomic.txt'), 'utf-8');
    expect(content).toBe('atomic content');

    writeSpy.mockRestore();
    renameSpy.mockRestore();
  });
});
