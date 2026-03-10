import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { createGitInitTool } from '../git-init.js';
import { createGitBranchTool } from '../git-branch.js';
import { createGitRemoteTool } from '../git-remote.js';

const toolCtx = { toolCallId: '1', messages: [] };

describe('git-init tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-init-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('initializes a new repository', async () => {
    const t = createGitInitTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('Initialized');

    // Verify .git exists
    const stat = await fs.stat(path.join(tmpDir, '.git'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('reports if already inside a git repository', async () => {
    await execa('git', ['init'], { cwd: tmpDir });
    const t = createGitInitTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('Already inside a git repository');
  });

  it('uses custom branch name', async () => {
    const t = createGitInitTool(tmpDir);
    const result = await t.execute!({ defaultBranch: 'develop' }, toolCtx);
    expect(result).toContain('Initialized');

    // Verify the branch name
    const branch = await execa('git', ['branch', '--show-current'], { cwd: tmpDir });
    expect(branch.stdout.trim()).toBe('develop');
  });
});

describe('git-branch tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-branch-'));
    await execa('git', ['init', '-b', 'main'], { cwd: tmpDir });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists branches (empty repo)', async () => {
    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'list' }, toolCtx);
    // Empty repo has no commits, so no branches to list
    expect(typeof result).toBe('string');
  });

  it('creates a new branch after initial commit', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });

    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'create', name: 'feature-x' }, toolCtx);
    expect(result).not.toContain('Error');

    // Verify branch exists
    const branches = await execa('git', ['branch'], { cwd: tmpDir });
    expect(branches.stdout).toContain('feature-x');
  });

  it('switches to an existing branch', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });
    await execa('git', ['branch', 'feature-y'], { cwd: tmpDir });

    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'switch', name: 'feature-y' }, toolCtx);
    expect(result).not.toContain('Error');

    const current = await execa('git', ['branch', '--show-current'], { cwd: tmpDir });
    expect(current.stdout.trim()).toBe('feature-y');
  });

  it('deletes a merged branch', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });
    await execa('git', ['branch', 'to-delete'], { cwd: tmpDir });

    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'delete', name: 'to-delete' }, toolCtx);
    expect(result).not.toContain('Error');

    const branches = await execa('git', ['branch'], { cwd: tmpDir });
    expect(branches.stdout).not.toContain('to-delete');
  });

  it('rejects branch name starting with -', async () => {
    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'create', name: '-bad-name' }, toolCtx);
    expect(result).toContain('Error');
    expect(result).toContain('cannot start with "-"');
  });

  it('requires name for create action', async () => {
    const t = createGitBranchTool(tmpDir);
    const result = await t.execute!({ action: 'create' }, toolCtx);
    expect(result).toContain('Error');
    expect(result).toContain('required');
  });
});

describe('git-remote tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-remote-'));
    await execa('git', ['init', '-b', 'main'], { cwd: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('lists remotes (none configured)', async () => {
    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({ action: 'list' }, toolCtx);
    // No remotes → empty or completed message
    expect(typeof result).toBe('string');
    expect(result).not.toContain('Error');
  });

  it('adds a remote with valid URL', async () => {
    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({
      action: 'add',
      name: 'origin',
      url: 'https://github.com/user/repo.git',
    }, toolCtx);
    expect(result).not.toContain('Error');

    // Verify remote exists
    const remotes = await execa('git', ['remote', '-v'], { cwd: tmpDir });
    expect(remotes.stdout).toContain('origin');
    expect(remotes.stdout).toContain('https://github.com/user/repo.git');
  });

  it('gets URL of a remote', async () => {
    await execa('git', ['remote', 'add', 'origin', 'https://github.com/user/repo.git'], { cwd: tmpDir });

    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({ action: 'get-url', name: 'origin' }, toolCtx);
    expect(result).toContain('https://github.com/user/repo.git');
  });

  it('removes a remote', async () => {
    await execa('git', ['remote', 'add', 'upstream', 'https://github.com/other/repo.git'], { cwd: tmpDir });

    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({ action: 'remove', name: 'upstream' }, toolCtx);
    expect(result).not.toContain('Error');

    const remotes = await execa('git', ['remote', '-v'], { cwd: tmpDir });
    expect(remotes.stdout).not.toContain('upstream');
  });

  it('rejects invalid URL format', async () => {
    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({
      action: 'add',
      url: 'not-a-valid-url',
    }, toolCtx);
    expect(result).toContain('Error');
    expect(result).toContain('Invalid git URL');
  });

  it('requires URL for add action', async () => {
    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({ action: 'add', name: 'origin' }, toolCtx);
    expect(result).toContain('Error');
    expect(result).toContain('URL is required');
  });

  it('requires name for remove action', async () => {
    const t = createGitRemoteTool(tmpDir);
    const result = await t.execute!({ action: 'remove' }, toolCtx);
    expect(result).toContain('Error');
    expect(result).toContain('required');
  });
});
