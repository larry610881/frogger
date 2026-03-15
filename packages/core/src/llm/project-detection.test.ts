import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectProjectInfo, formatProjectInfo } from './project-detection.js';

describe('detectProjectInfo', () => {
  let tmpDir: string;

  async function makeTmpDir() {
    tmpDir = await mkdtemp(join(tmpdir(), 'frogger-detect-'));
    return tmpDir;
  }

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects TypeScript via tsconfig.json', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'tsconfig.json'), '{}');
    const info = await detectProjectInfo(dir);
    expect(info.languages).toContain('TypeScript');
  });

  it('detects Rust via Cargo.toml', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'Cargo.toml'), '[package]');
    const info = await detectProjectInfo(dir);
    expect(info.languages).toContain('Rust');
  });

  it('detects pnpm via lockfile', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'pnpm-lock.yaml'), '');
    const info = await detectProjectInfo(dir);
    expect(info.packageManager).toBe('pnpm');
  });

  it('detects npm via package-lock.json', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'package-lock.json'), '{}');
    const info = await detectProjectInfo(dir);
    expect(info.packageManager).toBe('npm');
  });

  it('detects monorepo via turbo.json', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'turbo.json'), '{}');
    const info = await detectProjectInfo(dir);
    expect(info.isMonorepo).toBe(true);
  });

  it('detects monorepo via pnpm-workspace.yaml', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'pnpm-workspace.yaml'), '');
    const info = await detectProjectInfo(dir);
    expect(info.isMonorepo).toBe(true);
  });

  it('detects git repo via .git directory', async () => {
    const dir = await makeTmpDir();
    await mkdir(join(dir, '.git'));
    const info = await detectProjectInfo(dir);
    expect(info.isGitRepo).toBe(true);
  });

  it('detects framework from package.json deps', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^1.0.0' },
    }));
    const info = await detectProjectInfo(dir);
    expect(info.framework).toBe('React');
    expect(info.testFramework).toBe('Vitest');
  });

  it('returns empty results for empty directory', async () => {
    const dir = await makeTmpDir();
    const info = await detectProjectInfo(dir);
    expect(info.languages).toEqual([]);
    expect(info.packageManager).toBeUndefined();
    expect(info.framework).toBeUndefined();
    expect(info.testFramework).toBeUndefined();
    expect(info.isMonorepo).toBe(false);
    expect(info.isGitRepo).toBe(false);
  });

  it('does not duplicate languages', async () => {
    const dir = await makeTmpDir();
    await writeFile(join(dir, 'pyproject.toml'), '');
    await writeFile(join(dir, 'setup.py'), '');
    const info = await detectProjectInfo(dir);
    expect(info.languages.filter(l => l === 'Python')).toHaveLength(1);
  });
});

describe('formatProjectInfo', () => {
  it('formats full project info as pipe-separated string', () => {
    const result = formatProjectInfo({
      languages: ['TypeScript'],
      packageManager: 'pnpm',
      framework: 'React',
      testFramework: 'Vitest',
      isMonorepo: true,
      isGitRepo: true,
    });
    expect(result).toBe('Language: TypeScript | Package manager: pnpm | Framework: React | Test framework: Vitest | Monorepo: yes | Git: yes');
  });

  it('formats minimal project info', () => {
    const result = formatProjectInfo({
      languages: [],
      isMonorepo: false,
      isGitRepo: false,
    });
    expect(result).toBe('Monorepo: no | Git: no');
  });

  it('joins multiple languages with comma', () => {
    const result = formatProjectInfo({
      languages: ['TypeScript', 'Python'],
      isMonorepo: false,
      isGitRepo: true,
    });
    expect(result).toContain('Language: TypeScript, Python');
  });
});
