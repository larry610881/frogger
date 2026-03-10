import { execa } from 'execa';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

interface GitCredentialEntry {
  host: string;
  username: string;
  token: string;
  createdAt: string;
}

interface GitCredentials {
  credentials: GitCredentialEntry[];
}

export interface GitAuthStatus {
  ghCli: { available: boolean; authenticated: boolean; username?: string };
  ssh: { hasKeys: boolean; keyPaths: string[] };
  credentialHelper: { configured: boolean; helper?: string };
  froggerPat: { hasCredentials: boolean; hosts: string[] };
}

const CREDENTIALS_DIR = join(homedir(), '.frogger');
const CREDENTIALS_PATH = join(CREDENTIALS_DIR, 'git-credentials.json');

export async function detectGitAuthStatus(): Promise<GitAuthStatus> {
  const [ghCli, ssh, credentialHelper, froggerPat] = await Promise.all([
    checkGhCli(),
    checkSshKeys(),
    checkCredentialHelper(),
    checkFroggerPat(),
  ]);
  return { ghCli, ssh, credentialHelper, froggerPat };
}

async function checkGhCli(): Promise<GitAuthStatus['ghCli']> {
  try {
    const result = await execa('gh', ['auth', 'status'], { reject: false });
    // gh outputs status info to stderr
    const output = result.stdout || result.stderr;
    if (result.exitCode === 0) {
      const match = output.match(/Logged in to \S+ as (\S+)/);
      return { available: true, authenticated: true, username: match?.[1] };
    }
    return { available: true, authenticated: false };
  } catch {
    return { available: false, authenticated: false };
  }
}

async function checkSshKeys(): Promise<GitAuthStatus['ssh']> {
  const sshDir = join(homedir(), '.ssh');
  const keyNames = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
  const keyPaths: string[] = [];
  for (const name of keyNames) {
    const pubPath = join(sshDir, `${name}.pub`);
    if (existsSync(pubPath)) {
      keyPaths.push(pubPath);
    }
  }
  return { hasKeys: keyPaths.length > 0, keyPaths };
}

async function checkCredentialHelper(): Promise<GitAuthStatus['credentialHelper']> {
  try {
    const result = await execa('git', ['config', '--global', 'credential.helper'], { reject: false });
    if (result.exitCode === 0 && result.stdout.trim()) {
      return { configured: true, helper: result.stdout.trim() };
    }
    return { configured: false };
  } catch {
    return { configured: false };
  }
}

async function checkFroggerPat(): Promise<GitAuthStatus['froggerPat']> {
  const creds = await loadGitCredentials();
  return {
    hasCredentials: creds.credentials.length > 0,
    hosts: creds.credentials.map(c => c.host),
  };
}

export async function loadGitCredentials(): Promise<GitCredentials> {
  try {
    const content = await readFile(CREDENTIALS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { credentials: [] };
  }
}

export async function saveGitCredentials(credentials: GitCredentials): Promise<void> {
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf-8');
  await chmod(CREDENTIALS_PATH, 0o600);
}

export function extractHostFromRemoteUrl(url: string): string | null {
  // https://github.com/user/repo.git
  const httpsMatch = url.match(/^https?:\/\/([^/]+)/);
  if (httpsMatch) return httpsMatch[1];

  // git@github.com:user/repo.git
  const sshMatch = url.match(/^git@([^:]+):/);
  if (sshMatch) return sshMatch[1];

  // ssh://git@github.com/user/repo.git
  const sshUrlMatch = url.match(/^ssh:\/\/(?:[^@]+@)?([^/:]+)/);
  if (sshUrlMatch) return sshUrlMatch[1];

  return null;
}

/**
 * Ensure the GIT_ASKPASS helper script exists.
 * The script reads the token from FROGGER_GIT_TOKEN env var.
 * The token never appears in command args or script content.
 */
async function ensureAskpassScript(): Promise<string> {
  const scriptPath = join(tmpdir(), 'frogger-git-askpass.sh');
  if (!existsSync(scriptPath)) {
    const script = '#!/bin/sh\necho "$FROGGER_GIT_TOKEN"';
    await writeFile(scriptPath, script, 'utf-8');
    await chmod(scriptPath, 0o700);
  }
  return scriptPath;
}

/**
 * Resolve Frogger PAT auth env for a known URL.
 * Assumes credential helper and gh CLI have already been checked.
 */
async function resolvePatEnvForUrl(url: string): Promise<Record<string, string>> {
  // SSH URLs → SSH agent handles auth
  if (url.startsWith('git@') || url.startsWith('ssh://')) return {};

  const host = extractHostFromRemoteUrl(url);
  if (host) {
    const creds = await loadGitCredentials();
    const entry = creds.credentials.find(c => c.host === host);
    if (entry) {
      const askpassPath = await ensureAskpassScript();
      return {
        GIT_ASKPASS: askpassPath,
        GIT_TERMINAL_PROMPT: '0',
        FROGGER_GIT_TOKEN: entry.token,
      };
    }
  }
  return {};
}

/**
 * Resolve git auth env vars for an existing repo's remote.
 * Returns env vars to inject into execa — PAT never enters LLM context.
 */
export async function resolveGitAuthEnv(workingDirectory: string): Promise<Record<string, string>> {
  // 1. Credential helper → git handles transparently
  const credHelper = await checkCredentialHelper();
  if (credHelper.configured) return {};

  // 2. gh CLI → handles auth transparently when installed
  const ghStatus = await checkGhCli();
  if (ghStatus.authenticated) return {};

  // 3. Resolve from remote URL
  try {
    const result = await execa('git', ['remote', 'get-url', 'origin'], {
      cwd: workingDirectory,
      reject: false,
    });
    if (result.exitCode === 0) {
      return resolvePatEnvForUrl(result.stdout.trim());
    }
  } catch {
    // No remote configured
  }

  return {};
}

/**
 * Resolve git auth env vars for a given URL (used by clone before repo exists).
 * Returns env vars to inject into execa — PAT never enters LLM context.
 */
export async function resolveGitAuthEnvForUrl(url: string): Promise<Record<string, string>> {
  // 1. Credential helper → git handles transparently
  const credHelper = await checkCredentialHelper();
  if (credHelper.configured) return {};

  // 2. gh CLI → handles auth transparently when installed
  const ghStatus = await checkGhCli();
  if (ghStatus.authenticated) return {};

  // 3. Frogger PAT
  return resolvePatEnvForUrl(url);
}

/**
 * Filter sensitive information from git command output.
 * Removes lines containing credential-related keywords.
 */
export function filterSensitiveOutput(output: string): string {
  return output
    .split('\n')
    .filter(line => {
      const lower = line.toLowerCase();
      return !lower.includes('password') &&
        !lower.includes('token') &&
        !lower.includes('credential') &&
        !lower.includes('authorization');
    })
    .join('\n');
}
