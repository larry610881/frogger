import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createGlobTool } from '../glob.js';

describe('glob tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-test-'));
    await fs.writeFile(path.join(tmpDir, 'a.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'b.ts'), '');
    await fs.writeFile(path.join(tmpDir, 'c.js'), '');
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(path.join(tmpDir, 'sub', 'd.ts'), '');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds files matching a pattern', async () => {
    const t = createGlobTool(tmpDir);
    const result = await t.execute!({ pattern: '*.ts' }, { toolCallId: '1', messages: [] });
    const files = JSON.parse(result as string);
    expect(files).toContain('a.ts');
    expect(files).toContain('b.ts');
    expect(files).not.toContain('c.js');
  });

  it('supports recursive patterns', async () => {
    const t = createGlobTool(tmpDir);
    const result = await t.execute!({ pattern: '**/*.ts' }, { toolCallId: '1', messages: [] });
    const files = JSON.parse(result as string);
    expect(files).toContain('a.ts');
    expect(files).toContain('sub/d.ts');
  });
});
