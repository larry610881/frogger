import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createEditFileTool } from '../edit-file.js';

describe('edit-file tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('performs exact match replacement', async () => {
    await fs.writeFile(path.join(tmpDir, 'test.ts'), 'const x = 1;\nconst y = 2;\n');
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'test.ts', old_text: 'const x = 1;', new_text: 'const x = 42;' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('exact match');

    const content = await fs.readFile(path.join(tmpDir, 'test.ts'), 'utf-8');
    expect(content).toContain('const x = 42;');
    expect(content).toContain('const y = 2;');
  });

  it('rejects ambiguous matches', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'dup.ts'),
      'const x = 1;\nconst x = 1;\n',
    );
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'dup.ts', old_text: 'const x = 1;', new_text: 'const x = 2;' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('2 matches');
  });

  it('returns error for non-existent file', async () => {
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'missing.ts', old_text: 'a', new_text: 'b' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Error:');
  });

  it('replace_all replaces all occurrences', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'multi.ts'),
      'const x = 1;\nconst x = 1;\nconst x = 1;\n',
    );
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      {
        path: 'multi.ts',
        old_text: 'const x = 1;',
        new_text: 'const x = 99;',
        replace_all: true,
      },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('3 replacements');

    const content = await fs.readFile(path.join(tmpDir, 'multi.ts'), 'utf-8');
    expect(content).toBe('const x = 99;\nconst x = 99;\nconst x = 99;\n');
  });

  it('replace_all with single occurrence still works', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'single.ts'),
      'const x = 1;\nconst y = 2;\n',
    );
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      {
        path: 'single.ts',
        old_text: 'const x = 1;',
        new_text: 'const x = 42;',
        replace_all: true,
      },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('exact match');

    const content = await fs.readFile(path.join(tmpDir, 'single.ts'), 'utf-8');
    expect(content).toBe('const x = 42;\nconst y = 2;\n');
  });

  it('without replace_all, multiple matches still errors', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'dup2.ts'),
      'const x = 1;\nconst x = 1;\n',
    );
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'dup2.ts', old_text: 'const x = 1;', new_text: 'const x = 2;' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('2 matches');
    expect(result).toContain('Error');
  });

  it('rejects path traversal', async () => {
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: '../../etc/passwd', old_text: 'root', new_text: 'hacked' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Error:');
    expect(result).toContain('escapes');
  });

  it('shows hint to re-read file when no match found', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'nomatch.ts'),
      'hello world\n',
    );
    const t = createEditFileTool(tmpDir);
    const result = await t.execute!(
      { path: 'nomatch.ts', old_text: 'completely different text that will never match anything here at all xyz', new_text: 'replacement' },
      { toolCallId: '1', messages: [] },
    );
    expect(result).toContain('Error: Could not find a match');
    expect(result).toContain('Hint: Re-read the file to see current content, then retry with exact match.');
  });
});
