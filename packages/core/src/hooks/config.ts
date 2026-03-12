import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { z } from 'zod';
import { CONFIG_DIR } from '@frogger/shared';
import { logger } from '../utils/logger.js';

const HookEntrySchema = z.object({
  matcher: z.string(),
  command: z.string(),
  timeout: z.number().min(1000).max(60_000).optional(),
});

const HooksConfigSchema = z.object({
  hooks: z.object({
    PreToolUse: z.array(HookEntrySchema).optional().default([]),
    PostToolUse: z.array(HookEntrySchema).optional().default([]),
  }),
});

export type HookEntry = z.infer<typeof HookEntrySchema>;

export interface HooksConfig {
  hooks: {
    PreToolUse: HookEntry[];
    PostToolUse: HookEntry[];
  };
  needsConfirmation?: { filePath: string };
}

export interface LoadHooksOptions {
  /** Path to the confirmed-hooks.json store. Defaults to ~/.frogger/confirmed-hooks.json */
  confirmedHooksPath?: string;
}

const EMPTY_CONFIG: HooksConfig = {
  hooks: { PreToolUse: [], PostToolUse: [] },
};

const DEFAULT_TIMEOUT = 10_000;

// ─── Confirmation helpers ────────────────────────────────────────────

/** Default path to the confirmed hooks hash store */
function getDefaultConfirmedHooksPath(): string {
  return path.join(homedir(), CONFIG_DIR, 'confirmed-hooks.json');
}

/** Load the confirmed hooks hash map */
function loadConfirmedHashes(storePath: string): Record<string, string> {
  if (!fs.existsSync(storePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  } catch {
    return {};
  }
}

/** Save the confirmed hooks hash map */
function saveConfirmedHashes(storePath: string, hashes: Record<string, string>): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
}

/** Compute SHA-256 hash of file contents */
function hashFileContent(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if a hooks.json file has been confirmed by the user.
 * If the file does not exist, returns true (nothing to confirm).
 */
export function isHooksConfirmed(filePath: string, storePath?: string): boolean {
  if (!fs.existsSync(filePath)) return true;

  const resolvedStore = storePath ?? getDefaultConfirmedHooksPath();
  const absolutePath = path.resolve(filePath);
  const hashes = loadConfirmedHashes(resolvedStore);
  const storedHash = hashes[absolutePath];
  if (!storedHash) return false;

  try {
    const currentHash = hashFileContent(filePath);
    return currentHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Mark a hooks.json file as confirmed by computing and storing its hash.
 */
export function confirmHooks(filePath: string, storePath?: string): void {
  if (!fs.existsSync(filePath)) return;
  const resolvedStore = storePath ?? getDefaultConfirmedHooksPath();
  const absolutePath = path.resolve(filePath);
  const hashes = loadConfirmedHashes(resolvedStore);
  hashes[absolutePath] = hashFileContent(filePath);
  saveConfirmedHashes(resolvedStore, hashes);
}

// ─── Hooks loading ───────────────────────────────────────────────────

/**
 * Load hooks.json from a directory. Returns parsed config or empty config on failure.
 */
function loadHooksFile(dir: string): HooksConfig | null {
  const filePath = path.join(dir, CONFIG_DIR, 'hooks.json');
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    const result = HooksConfigSchema.safeParse(json);
    if (!result.success) {
      logger.warn(`Invalid hooks config at ${filePath}: ${result.error.message}`);
      return null;
    }
    // Apply default timeout
    for (const entry of [...result.data.hooks.PreToolUse, ...result.data.hooks.PostToolUse]) {
      if (entry.timeout === undefined) {
        entry.timeout = DEFAULT_TIMEOUT;
      }
    }
    return result.data;
  } catch (err) {
    logger.warn(`Failed to parse hooks config at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Load and merge hooks config from global (`~/.frogger/hooks.json`)
 * and project-level (`{workDir}/.frogger/hooks.json`).
 * Global hooks fire first, then project hooks.
 *
 * When `options.confirmedHooksPath` is provided, project-level hooks require
 * SHA-256 confirmation. Unconfirmed project hooks are skipped and the result
 * includes `needsConfirmation` with the file path.
 */
export function loadHooksConfig(workingDirectory: string, options?: LoadHooksOptions): HooksConfig {
  const globalConfig = loadHooksFile(homedir());

  // Check project-level hooks confirmation when options are provided
  let projectConfig: HooksConfig | null = null;
  let needsConfirmation: { filePath: string } | undefined;

  if (options?.confirmedHooksPath) {
    const projectHooksPath = path.join(workingDirectory, CONFIG_DIR, 'hooks.json');
    if (fs.existsSync(projectHooksPath)) {
      if (isHooksConfirmed(projectHooksPath, options.confirmedHooksPath)) {
        projectConfig = loadHooksFile(workingDirectory);
      } else {
        // Skip unconfirmed project hooks
        needsConfirmation = { filePath: projectHooksPath };
        logger.warn(`Project hooks at ${projectHooksPath} require confirmation — skipping`);
      }
    }
  } else {
    projectConfig = loadHooksFile(workingDirectory);
  }

  if (!globalConfig && !projectConfig) {
    return needsConfirmation ? { ...EMPTY_CONFIG, needsConfirmation } : EMPTY_CONFIG;
  }
  if (!globalConfig) {
    return needsConfirmation ? { ...projectConfig!, needsConfirmation } : projectConfig!;
  }
  if (!projectConfig) {
    return needsConfirmation ? { ...globalConfig, needsConfirmation } : globalConfig;
  }

  // Merge: global first, then project
  const merged: HooksConfig = {
    hooks: {
      PreToolUse: [...globalConfig.hooks.PreToolUse, ...projectConfig.hooks.PreToolUse],
      PostToolUse: [...globalConfig.hooks.PostToolUse, ...projectConfig.hooks.PostToolUse],
    },
  };
  if (needsConfirmation) {
    merged.needsConfirmation = needsConfirmation;
  }
  return merged;
}
