import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR } from '@frogger/shared';
import { getGlobalPermissionsPath } from './rules.js';

/** Path to the confirmed permissions hash store */
function getConfirmedPermissionsPath(): string {
  return path.join(homedir(), CONFIG_DIR, 'confirmed-permissions.json');
}

/** Load the confirmed permissions hash map */
function loadConfirmedHashes(): Record<string, string> {
  const filePath = getConfirmedPermissionsPath();
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

/** Save the confirmed permissions hash map */
function saveConfirmedHashes(hashes: Record<string, string>): void {
  const filePath = getConfirmedPermissionsPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
}

/** Compute SHA-256 hash of file contents */
function hashFileContent(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Check if a permissions.json file has been confirmed by the user.
 * - Global permissions path → always confirmed (user's own config)
 * - Project permissions path → must match stored hash
 */
export function isPermissionsConfirmed(filePath: string): boolean {
  const globalPath = getGlobalPermissionsPath();
  if (path.resolve(filePath) === path.resolve(globalPath)) return true;
  if (!existsSync(filePath)) return true; // No file = nothing to confirm

  const absolutePath = path.resolve(filePath);
  const hashes = loadConfirmedHashes();
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
 * Mark a permissions.json file as confirmed by computing and storing its hash.
 */
export function confirmPermissions(filePath: string): void {
  if (!existsSync(filePath)) return;
  const absolutePath = path.resolve(filePath);
  const hashes = loadConfirmedHashes();
  hashes[absolutePath] = hashFileContent(filePath);
  saveConfirmedHashes(hashes);
}
