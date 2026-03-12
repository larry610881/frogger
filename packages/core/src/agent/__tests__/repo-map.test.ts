import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateRepoMap, clearRepoMapCache } from '../repo-map.js';

describe('generateRepoMap', () => {
  let tmpDir: string;

  beforeEach(async () => {
    clearRepoMapCache();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repo-map-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates tree structure for nested directories', async () => {
    // Create a small project structure
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src', 'utils'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'src', 'utils', 'helper.ts'), '');

    const result = await generateRepoMap({ workingDirectory: tmpDir });
    expect(result).toBeDefined();
    expect(result).toContain('package.json');
    expect(result).toContain('src/');
    expect(result).toContain('index.ts');
    expect(result).toContain('utils/');
    expect(result).toContain('helper.ts');
  });

  it('returns undefined for empty directory', async () => {
    const result = await generateRepoMap({ workingDirectory: tmpDir });
    expect(result).toBeUndefined();
  });

  it('returns notice when file count exceeds maxFiles', async () => {
    // Create many files
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(path.join(tmpDir, `file-${i}.txt`), '');
    }

    const result = await generateRepoMap({
      workingDirectory: tmpDir,
      maxFiles: 3,
    });
    expect(result).toContain('too large for map');
    expect(result).toContain('5 files');
  });

  it('respects maxOutputChars', async () => {
    for (let i = 0; i < 20; i++) {
      await fs.writeFile(path.join(tmpDir, `file-${String(i).padStart(2, '0')}.txt`), '');
    }

    const result = await generateRepoMap({
      workingDirectory: tmpDir,
      maxOutputChars: 100,
    });
    expect(result).toBeDefined();
    expect(result!.length).toBeLessThanOrEqual(120); // Allow some slack for truncation notice
    expect(result).toContain('... (truncated)');
  });

  it('returns cached result within TTL window', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), '');

    const first = await generateRepoMap({ workingDirectory: tmpDir });
    expect(first).toContain('a.txt');

    // Add a new file — should still get cached result
    await fs.writeFile(path.join(tmpDir, 'b.txt'), '');
    const second = await generateRepoMap({ workingDirectory: tmpDir });
    expect(second).toBe(first); // Same reference = cache hit
    expect(second).not.toContain('b.txt');
  });

  it('returns fresh result after cache is cleared', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), '');

    const first = await generateRepoMap({ workingDirectory: tmpDir });
    expect(first).toContain('a.txt');

    await fs.writeFile(path.join(tmpDir, 'b.txt'), '');
    clearRepoMapCache();
    const second = await generateRepoMap({ workingDirectory: tmpDir });
    expect(second).toContain('b.txt');
  });

  it('excludes node_modules and .git', async () => {
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), '');
    await fs.mkdir(path.join(tmpDir, '.git', 'objects'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.git', 'objects', 'abc'), '');
    await fs.writeFile(path.join(tmpDir, 'src.ts'), '');

    const result = await generateRepoMap({ workingDirectory: tmpDir });
    expect(result).toBeDefined();
    expect(result).toContain('src.ts');
    expect(result).not.toContain('node_modules');
    expect(result).not.toContain('.git');
  });
});
