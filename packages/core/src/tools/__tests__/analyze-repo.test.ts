import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAnalyzeRepoTool } from '../analyze-repo.js';

describe('analyze-repo tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-analyze-'));

    // Create a mock project structure
    await fs.mkdir(path.join(tmpDir, 'src', 'components'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'src', 'utils'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, '__tests__'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });

    // Create files
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Test Project');
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'tsconfig.json'), '{}');
    await fs.writeFile(path.join(tmpDir, 'src', 'index.ts'), 'export {}');
    await fs.writeFile(path.join(tmpDir, 'src', 'components', 'App.tsx'), '<App />');
    await fs.writeFile(path.join(tmpDir, 'src', 'components', 'Header.tsx'), '<Header />');
    await fs.writeFile(path.join(tmpDir, 'src', 'utils', 'helpers.ts'), 'export {}');
    await fs.writeFile(path.join(tmpDir, '__tests__', 'app.test.ts'), 'test()');
    await fs.writeFile(path.join(tmpDir, 'docs', 'guide.md'), '# Guide');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('analyzes a directory structure with default depth', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('## Repository Structure (depth: 3)');
    expect(result).toContain('src/');
    expect(result).toContain('index.ts');
    expect(result).toContain('App.tsx');
    expect(result).toContain('Header.tsx');
    expect(result).toContain('helpers.ts');
    expect(result).toContain('guide.md');
  });

  it('includes file type distribution', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('## File Types');
    expect(result).toContain('.ts:');
    expect(result).toContain('.tsx:');
    expect(result).toContain('.md:');
    expect(result).toContain('.json:');
  });

  it('lists key files', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('## Key Files');
    expect(result).toContain('README.md (documentation)');
    expect(result).toContain('package.json (Node.js project)');
    expect(result).toContain('tsconfig.json (TypeScript config)');
  });

  it('respects depth limit', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: 1 }, { toolCallId: '1', messages: [] });

    expect(result).toContain('## Repository Structure (depth: 1)');
    expect(result).toContain('src/');
    // At depth 1 we see top-level files and dirs, but not nested contents
    expect(result).not.toContain('App.tsx');
    expect(result).not.toContain('index.ts');
  });

  it('analyzes a subdirectory', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: 'src', depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('## Repository Structure (depth: 3)');
    expect(result).toContain('src/');
    expect(result).toContain('components/');
    expect(result).toContain('App.tsx');
  });

  it('skips .git and node_modules directories', async () => {
    await fs.mkdir(path.join(tmpDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.git', 'config'), '');
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'some-pkg'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'some-pkg', 'index.js'), '');

    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).not.toContain('node_modules');
    expect(result).not.toContain('.git/');
    expect(result).not.toContain('some-pkg');
  });

  it('rejects path traversal', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: '../../etc', depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('Error:');
    expect(result).toContain('escapes');
  });

  it('returns error for non-existent directory', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: 'nonexistent', depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('Error:');
  });

  it('marks test directories with test icon', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: undefined, depth: undefined }, { toolCallId: '1', messages: [] });

    // __tests__ should have the test icon
    expect(result).toContain('\u{1F9EA}');
    expect(result).toContain('__tests__/');
  });

  it('returns error for file path instead of directory', async () => {
    const t = createAnalyzeRepoTool(tmpDir);
    const result = await t.execute!({ path: 'README.md', depth: undefined }, { toolCallId: '1', messages: [] });

    expect(result).toContain('Error:');
    expect(result).toContain('is not a directory');
  });
});
