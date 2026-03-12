import { describe, it, expect } from 'vitest';
import { generateUnifiedDiff } from '../diff-utils.js';

describe('generateUnifiedDiff', () => {
  it('returns empty string for identical content', () => {
    const result = generateUnifiedDiff('file.txt', 'hello\nworld\n', 'hello\nworld\n');
    expect(result).toBe('');
  });

  it('shows added lines', () => {
    const result = generateUnifiedDiff('file.txt', '', 'line1\nline2\n');
    expect(result).toContain('+++ b/file.txt');
    expect(result).toContain('+line1');
    expect(result).toContain('+line2');
  });

  it('shows removed lines', () => {
    const result = generateUnifiedDiff('file.txt', 'line1\nline2\n', '');
    expect(result).toContain('--- a/file.txt');
    expect(result).toContain('-line1');
    expect(result).toContain('-line2');
  });

  it('shows modified lines', () => {
    const result = generateUnifiedDiff('file.txt', 'old line\n', 'new line\n');
    expect(result).toContain('-old line');
    expect(result).toContain('+new line');
  });

  it('includes file headers', () => {
    const result = generateUnifiedDiff('src/index.ts', 'a\n', 'b\n');
    expect(result).toContain('--- a/src/index.ts');
    expect(result).toContain('+++ b/src/index.ts');
  });

  it('includes hunk header with line numbers', () => {
    const result = generateUnifiedDiff('f.txt', 'a\n', 'b\n');
    expect(result).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });

  it('handles multi-line changes with context', () => {
    const old = 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\n';
    const newContent = 'line1\nline2\nline3\nCHANGED\nline5\nline6\nline7\nline8\n';
    const result = generateUnifiedDiff('f.txt', old, newContent);
    expect(result).toContain('-line4');
    expect(result).toContain('+CHANGED');
    // Context lines should be present
    expect(result).toContain(' line3');
    expect(result).toContain(' line5');
  });

  it('handles completely different content', () => {
    const result = generateUnifiedDiff('f.txt', 'aaa\nbbb\nccc\n', 'xxx\nyyy\nzzz\n');
    expect(result).toContain('-aaa');
    expect(result).toContain('+xxx');
  });

  it('handles empty old content (new file)', () => {
    const result = generateUnifiedDiff('new.ts', '', 'export const x = 1;\n');
    expect(result).toContain('+export const x = 1;');
  });

  it('handles empty new content (deleted file)', () => {
    const result = generateUnifiedDiff('old.ts', 'export const x = 1;\n', '');
    expect(result).toContain('-export const x = 1;');
  });
});
