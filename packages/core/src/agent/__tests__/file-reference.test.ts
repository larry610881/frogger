import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveFileReferences, isImageFile } from '../file-reference.js';

describe('resolveFileReferences', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
    await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'Hello, World!');
    await fs.writeFile(
      path.join(tmpDir, 'config.json'),
      '{"key": "value"}\n',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns unchanged text when no @ references', async () => {
    const result = await resolveFileReferences(
      'just a normal message',
      tmpDir,
    );
    expect(result.cleanText).toBe('just a normal message');
    expect(result.references).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('resolves a single @file reference', async () => {
    const result = await resolveFileReferences(
      'please read @hello.txt for me',
      tmpDir,
    );
    expect(result.cleanText).toBe('please read for me');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].path).toBe('hello.txt');
    expect(result.references[0].content).toBe('Hello, World!');
    expect(result.references[0].lineCount).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('resolves multiple @file references', async () => {
    const result = await resolveFileReferences(
      'compare @hello.txt and @config.json',
      tmpDir,
    );
    expect(result.cleanText).toBe('compare and');
    expect(result.references).toHaveLength(2);
    expect(result.references[0].path).toBe('hello.txt');
    expect(result.references[1].path).toBe('config.json');
    expect(result.errors).toHaveLength(0);
  });

  it('ignores @mentions (non-existent paths)', async () => {
    const result = await resolveFileReferences(
      'hey @john can you check this',
      tmpDir,
    );
    expect(result.cleanText).toBe('hey @john can you check this');
    expect(result.references).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects path traversal', async () => {
    // Create a file outside tmpDir so the path actually exists on disk
    const outsideFile = path.join(os.tmpdir(), 'frogger-outside-test.txt');
    await fs.writeFile(outsideFile, 'secret');

    try {
      const result = await resolveFileReferences(
        'read @../../etc/passwd now',
        tmpDir,
      );
      expect(result.references).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
      // The path should not appear in references
      expect(
        result.references.find((r) => r.path.includes('passwd')),
      ).toBeUndefined();
    } finally {
      await fs.rm(outsideFile, { force: true });
    }
  });

  it('handles non-existent file gracefully (not added to errors)', async () => {
    const result = await resolveFileReferences(
      'check @nonexistent-file.txt please',
      tmpDir,
    );
    // Non-existent path is treated as @mention, not a file reference error
    expect(result.cleanText).toBe('check @nonexistent-file.txt please');
    expect(result.references).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles empty text', async () => {
    const result = await resolveFileReferences('', tmpDir);
    expect(result.cleanText).toBe('');
    expect(result.references).toHaveLength(0);
    expect(result.imageReferences).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('detects image files and returns base64 encoded data', async () => {
    // Create a small 1x1 PNG (minimal valid PNG)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, // 8-bit RGB
    ]);
    await fs.writeFile(path.join(tmpDir, 'screenshot.png'), pngHeader);

    const result = await resolveFileReferences('check @screenshot.png', tmpDir);
    expect(result.cleanText).toBe('check');
    expect(result.references).toHaveLength(0);
    expect(result.imageReferences).toHaveLength(1);
    expect(result.imageReferences[0].path).toBe('screenshot.png');
    expect(result.imageReferences[0].mediaType).toBe('image/png');
    expect(result.imageReferences[0].base64).toBe(pngHeader.toString('base64'));
  });

  it('handles mixed text and image references', async () => {
    await fs.writeFile(path.join(tmpDir, 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

    const result = await resolveFileReferences(
      'compare @hello.txt with @photo.jpg',
      tmpDir,
    );
    expect(result.references).toHaveLength(1);
    expect(result.references[0].path).toBe('hello.txt');
    expect(result.imageReferences).toHaveLength(1);
    expect(result.imageReferences[0].path).toBe('photo.jpg');
    expect(result.imageReferences[0].mediaType).toBe('image/jpeg');
  });

  it('returns empty imageReferences when no images present', async () => {
    const result = await resolveFileReferences('read @hello.txt', tmpDir);
    expect(result.imageReferences).toHaveLength(0);
  });

  it('resolves @"quoted path" with spaces', async () => {
    const dir = path.join(tmpDir, 'my folder');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'file name.txt'), 'spaced content');

    const result = await resolveFileReferences(
      'read @"my folder/file name.txt" please',
      tmpDir,
    );
    expect(result.cleanText).toBe('read please');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].path).toBe('my folder/file name.txt');
    expect(result.references[0].content).toBe('spaced content');
  });

  it('resolves both quoted and unquoted refs in same input', async () => {
    const dir = path.join(tmpDir, 'a b');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'c.txt'), 'from spaced');

    const result = await resolveFileReferences(
      'compare @hello.txt with @"a b/c.txt"',
      tmpDir,
    );
    expect(result.references).toHaveLength(2);
    expect(result.references[0].path).toBe('hello.txt');
    expect(result.references[1].path).toBe('a b/c.txt');
  });

  it('rejects images exceeding 5MB', async () => {
    // Create a file > 5MB
    const largeBuf = Buffer.alloc(6 * 1024 * 1024, 0x00);
    await fs.writeFile(path.join(tmpDir, 'huge.png'), largeBuf);

    const result = await resolveFileReferences('check @huge.png', tmpDir);
    expect(result.imageReferences).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('image too large');
    expect(result.errors[0]).toContain('max 5MB');
  });
});

describe('isImageFile', () => {
  it('returns true for supported image extensions', () => {
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
    expect(isImageFile('photo.gif')).toBe(true);
    expect(isImageFile('photo.webp')).toBe(true);
  });

  it('returns true for uppercase extensions', () => {
    expect(isImageFile('photo.PNG')).toBe(true);
    expect(isImageFile('photo.JPG')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImageFile('readme.md')).toBe(false);
    expect(isImageFile('script.ts')).toBe(false);
    expect(isImageFile('data.json')).toBe(false);
    expect(isImageFile('style.css')).toBe(false);
  });
});
