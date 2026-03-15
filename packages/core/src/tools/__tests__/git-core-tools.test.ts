import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { createGitStatusTool, gitStatusMetadata } from '../git-status.js';
import { createGitDiffTool, gitDiffMetadata } from '../git-diff.js';
import { createGitLogTool, gitLogMetadata } from '../git-log.js';
import { createGitCommitTool, gitCommitMetadata } from '../git-commit.js';

const toolCtx = { toolCallId: '1', messages: [] };

async function initRepo(dir: string) {
  await execa('git', ['init', '-b', 'main'], { cwd: dir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

describe('git-status tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-status-'));
    await initRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct metadata', () => {
    expect(gitStatusMetadata.name).toBe('git-status');
    expect(gitStatusMetadata.permissionLevel).toBe('auto');
  });

  it('shows clean working tree when no changes', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });

    const t = createGitStatusTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toBe('(clean working tree)');
  });

  it('shows untracked files', async () => {
    await fs.writeFile(path.join(tmpDir, 'new-file.txt'), 'content');

    const t = createGitStatusTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('??');
    expect(result).toContain('new-file.txt');
  });

  it('shows modified files', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'changed');

    const t = createGitStatusTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('M');
    expect(result).toContain('file.txt');
  });

  it('shows staged files', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });

    const t = createGitStatusTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('A');
    expect(result).toContain('file.txt');
  });

  it('returns error for non-git directory', async () => {
    const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-nogit-'));
    const t = createGitStatusTool(nonGitDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('Error');
    await fs.rm(nonGitDir, { recursive: true, force: true });
  });
});

describe('git-diff tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-diff-'));
    await initRepo(tmpDir);
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line1\nline2\n');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct metadata', () => {
    expect(gitDiffMetadata.name).toBe('git-diff');
    expect(gitDiffMetadata.permissionLevel).toBe('auto');
  });

  it('shows no changes when working tree is clean', async () => {
    const t = createGitDiffTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toBe('(no changes)');
  });

  it('shows unstaged changes', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line1\nmodified\n');

    const t = createGitDiffTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('-line2');
    expect(result).toContain('+modified');
  });

  it('shows staged changes with staged flag', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'line1\nstaged-change\n');
    await execa('git', ['add', '.'], { cwd: tmpDir });

    const t = createGitDiffTool(tmpDir);
    const result = await t.execute!({ staged: true }, toolCtx);
    expect(result).toContain('-line2');
    expect(result).toContain('+staged-change');
  });

  it('shows diff for specific file only', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'changed1\n');
    await fs.writeFile(path.join(tmpDir, 'other.txt'), 'changed2\n');
    await execa('git', ['add', 'other.txt'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'add other'], { cwd: tmpDir });
    await fs.writeFile(path.join(tmpDir, 'other.txt'), 'modified other\n');

    const t = createGitDiffTool(tmpDir);
    const result = await t.execute!({ file: 'file.txt' }, toolCtx);
    expect(result).toContain('file.txt');
    expect(result).not.toContain('other.txt');
  });

  it('returns no changes for unstaged when all staged', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'staged\n');
    await execa('git', ['add', '.'], { cwd: tmpDir });

    const t = createGitDiffTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toBe('(no changes)');
  });
});

describe('git-log tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-log-'));
    await initRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct metadata', () => {
    expect(gitLogMetadata.name).toBe('git-log');
    expect(gitLogMetadata.permissionLevel).toBe('auto');
  });

  it('shows commit history', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'v1');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'first commit'], { cwd: tmpDir });

    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'v2');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'second commit'], { cwd: tmpDir });

    const t = createGitLogTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    expect(result).toContain('first commit');
    expect(result).toContain('second commit');
  });

  it('limits output to requested count', async () => {
    for (let i = 0; i < 5; i++) {
      await fs.writeFile(path.join(tmpDir, `file${i}.txt`), `v${i}`);
      await execa('git', ['add', '.'], { cwd: tmpDir });
      await execa('git', ['commit', '-m', `commit-${i}`], { cwd: tmpDir });
    }

    const t = createGitLogTool(tmpDir);
    const result = await t.execute!({ count: 2 }, toolCtx);
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('caps count at 50', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });

    const t = createGitLogTool(tmpDir);
    // Should not error even with large count
    const result = await t.execute!({ count: 100 }, toolCtx);
    expect(result).toContain('init');
  });

  it('returns no commits for empty repo', async () => {
    const t = createGitLogTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    // Empty repo has no commits → git log exits with error
    expect(result).toMatch(/Error|no commits/i);
  });

  it('defaults to 10 commits', async () => {
    for (let i = 0; i < 15; i++) {
      await fs.writeFile(path.join(tmpDir, `f${i}.txt`), `${i}`);
      await execa('git', ['add', '.'], { cwd: tmpDir });
      await execa('git', ['commit', '-m', `c${i}`], { cwd: tmpDir });
    }

    const t = createGitLogTool(tmpDir);
    const result = await t.execute!({}, toolCtx);
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(10);
  });
});

describe('git-commit tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frogger-git-commit-'));
    await initRepo(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('has correct metadata', () => {
    expect(gitCommitMetadata.name).toBe('git-commit');
    expect(gitCommitMetadata.permissionLevel).toBe('confirm');
  });

  it('stages all and commits when no files specified', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');

    const t = createGitCommitTool(tmpDir);
    const result = await t.execute!({ message: 'add file' }, toolCtx);
    expect(result).not.toContain('Error');

    // Verify commit exists
    const log = await execa('git', ['log', '--oneline'], { cwd: tmpDir });
    expect(log.stdout).toContain('add file');
  });

  it('stages only specified files', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'aaa');
    await fs.writeFile(path.join(tmpDir, 'b.txt'), 'bbb');

    const t = createGitCommitTool(tmpDir);
    const result = await t.execute!({ message: 'add a only', files: ['a.txt'] }, toolCtx);
    expect(result).not.toContain('Error');

    // Verify b.txt is still untracked
    const status = await execa('git', ['status', '--porcelain'], { cwd: tmpDir });
    expect(status.stdout).toContain('b.txt');
    expect(status.stdout).not.toContain('a.txt');
  });

  it('returns error when nothing to commit', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');
    await execa('git', ['add', '.'], { cwd: tmpDir });
    await execa('git', ['commit', '-m', 'init'], { cwd: tmpDir });

    const t = createGitCommitTool(tmpDir);
    const result = await t.execute!({ message: 'empty commit' }, toolCtx);
    expect(result).toContain('Error');
  });

  it('creates commit with correct message', async () => {
    await fs.writeFile(path.join(tmpDir, 'file.txt'), 'hello');

    const t = createGitCommitTool(tmpDir);
    await t.execute!({ message: 'feat(core): add feature X' }, toolCtx);

    const log = await execa('git', ['log', '--format=%s', '-1'], { cwd: tmpDir });
    expect(log.stdout.trim()).toBe('feat(core): add feature X');
  });

  it('handles staging error gracefully', async () => {
    const t = createGitCommitTool(tmpDir);
    // Trying to stage a non-existent file
    const result = await t.execute!({ message: 'test', files: ['nonexistent.txt'] }, toolCtx);
    expect(result).toContain('Error');
  });

  describe('files boundary check', () => {
    it('rejects files with path traversal', async () => {
      const t = createGitCommitTool(tmpDir);
      const result = await t.execute!(
        { message: 'evil', files: ['../../etc/passwd'] },
        toolCtx,
      );
      expect(result).toContain('Error');
      expect(result).toContain('escapes');
    });

    it('rejects absolute file paths outside boundary', async () => {
      const t = createGitCommitTool(tmpDir);
      const result = await t.execute!(
        { message: 'evil', files: ['/etc/passwd'] },
        toolCtx,
      );
      expect(result).toContain('Error');
      expect(result).toContain('escapes');
    });

    it('rejects if any file in array escapes boundary', async () => {
      await fs.writeFile(path.join(tmpDir, 'legit.txt'), 'ok');
      const t = createGitCommitTool(tmpDir);
      const result = await t.execute!(
        { message: 'mixed', files: ['legit.txt', '../../secret'] },
        toolCtx,
      );
      expect(result).toContain('Error');
      expect(result).toContain('escapes');
    });
  });
});
