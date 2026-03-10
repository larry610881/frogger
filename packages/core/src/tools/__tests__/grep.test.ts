import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createGrepTool } from '../grep.js';

describe('grep tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
    await fs.writeFile(
      path.join(tmpDir, 'hello.ts'),
      'const greeting = "Hello World";\nconsole.log(greeting);\n',
    );
    await fs.writeFile(
      path.join(tmpDir, 'foo.ts'),
      'function foo() {\n  return "bar";\n}\n',
    );
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(
      path.join(tmpDir, 'sub', 'deep.ts'),
      'const HELLO = "deep hello";\n',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const exec = (
    params: Record<string, unknown>,
  ): Promise<string> =>
    createGrepTool(tmpDir).execute!(params as never, {
      toolCallId: '1',
      messages: [],
    }) as Promise<string>;

  it('finds matches with basic pattern', async () => {
    const result = await exec({ pattern: 'Hello' });
    expect(result).toContain('Hello World');
  });

  it('returns no matches message for unmatched pattern', async () => {
    const result = await exec({ pattern: 'ZZZZNOTFOUND' });
    expect(result).toBe('No matches found');
  });

  describe('ignoreCase', () => {
    it('finds matches regardless of case when enabled', async () => {
      const result = await exec({ pattern: 'hello', ignoreCase: true });
      expect(result).toContain('Hello World');
      expect(result).toContain('deep hello');
    });

    it('does not find case-mismatched when disabled', async () => {
      const result = await exec({ pattern: 'hello', ignoreCase: false });
      // Should find "deep hello" but not "Hello World"
      expect(result).toContain('deep hello');
      expect(result).not.toContain('Hello World');
    });
  });

  describe('contextLines', () => {
    it('returns surrounding lines around matches', async () => {
      const result = await exec({ pattern: 'return', contextLines: 1 });
      // Should include the line before ("function foo()") and after ("}")
      expect(result).toContain('function foo()');
      expect(result).toContain('return "bar"');
      expect(result).toContain('}');
    });
  });

  describe('filesOnly', () => {
    it('returns only file paths with matches', async () => {
      const result = await exec({ pattern: 'Hello', filesOnly: true });
      expect(result).toContain('hello.ts');
      // Should not contain line content (just the path)
      expect(result).not.toContain('Hello World');
    });

    it('takes precedence over contextLines', async () => {
      const result = await exec({
        pattern: 'return',
        filesOnly: true,
        contextLines: 2,
      });
      expect(result).toContain('foo.ts');
      // filesOnly means no line content
      expect(result).not.toContain('return "bar"');
    });
  });

  describe('include filter', () => {
    it('limits search to matching files', async () => {
      const result = await exec({
        pattern: 'Hello',
        include: '*.ts',
      });
      expect(result).toContain('Hello World');
    });
  });
});
