import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ProjectInfo {
  languages: string[];
  packageManager?: string;
  framework?: string;
  testFramework?: string;
  isMonorepo: boolean;
  isGitRepo: boolean;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectProjectInfo(workingDir: string): Promise<ProjectInfo> {
  const languages: string[] = [];
  const langChecks: Array<[string, string]> = [
    ['tsconfig.json', 'TypeScript'],
    ['Cargo.toml', 'Rust'],
    ['go.mod', 'Go'],
    ['pyproject.toml', 'Python'],
    ['setup.py', 'Python'],
    ['Gemfile', 'Ruby'],
    ['pom.xml', 'Java'],
    ['build.gradle', 'Java'],
  ];

  for (const [file, lang] of langChecks) {
    if (await fileExists(path.join(workingDir, file)) && !languages.includes(lang)) {
      languages.push(lang);
    }
  }

  // Package manager detection (by lockfile)
  let packageManager: string | undefined;
  if (await fileExists(path.join(workingDir, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (await fileExists(path.join(workingDir, 'yarn.lock'))) packageManager = 'yarn';
  else if (await fileExists(path.join(workingDir, 'bun.lockb'))) packageManager = 'bun';
  else if (await fileExists(path.join(workingDir, 'package-lock.json'))) packageManager = 'npm';

  // Framework + test framework from package.json
  let framework: string | undefined;
  let testFramework: string | undefined;
  try {
    const pkgPath = path.join(workingDir, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps['next']) framework = 'Next.js';
    else if (allDeps['nuxt']) framework = 'Nuxt';
    else if (allDeps['@angular/core']) framework = 'Angular';
    else if (allDeps['vue']) framework = 'Vue';
    else if (allDeps['react']) framework = 'React';
    else if (allDeps['express']) framework = 'Express';
    else if (allDeps['fastify']) framework = 'Fastify';

    if (allDeps['vitest']) testFramework = 'Vitest';
    else if (allDeps['jest']) testFramework = 'Jest';
    else if (allDeps['mocha']) testFramework = 'Mocha';
  } catch {
    // no package.json
  }

  // Monorepo detection
  const isMonorepo = await fileExists(path.join(workingDir, 'pnpm-workspace.yaml')) ||
    await fileExists(path.join(workingDir, 'lerna.json')) ||
    await fileExists(path.join(workingDir, 'turbo.json'));

  // Git detection
  const isGitRepo = await fileExists(path.join(workingDir, '.git'));

  return { languages, packageManager, framework, testFramework, isMonorepo, isGitRepo };
}

export function formatProjectInfo(info: ProjectInfo): string {
  const parts: string[] = [];
  if (info.languages.length) parts.push(`Language: ${info.languages.join(', ')}`);
  if (info.packageManager) parts.push(`Package manager: ${info.packageManager}`);
  if (info.framework) parts.push(`Framework: ${info.framework}`);
  if (info.testFramework) parts.push(`Test framework: ${info.testFramework}`);
  parts.push(`Monorepo: ${info.isMonorepo ? 'yes' : 'no'}`);
  parts.push(`Git: ${info.isGitRepo ? 'yes' : 'no'}`);
  return parts.join(' | ');
}
