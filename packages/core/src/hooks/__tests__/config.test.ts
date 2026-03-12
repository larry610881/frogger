import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadHooksConfig, isHooksConfirmed, confirmHooks } from '../config.js';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/**
 * Helper: create a temp dir that acts as both "home" and "project" for isolated tests.
 * We pass confirmedHooksPath to the functions to avoid polluting the real ~/.frogger/.
 */

function makeTempDir(): string {
  return join(tmpdir(), `frogger-hooks-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function writeHooksJson(dir: string, content: object): string {
  const configDir = join(dir, '.frogger');
  mkdirSync(configDir, { recursive: true });
  const filePath = join(configDir, 'hooks.json');
  writeFileSync(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

describe('hooks confirmation', () => {
  let testDir: string;
  let confirmedStorePath: string;

  beforeEach(() => {
    testDir = makeTempDir();
    mkdirSync(testDir, { recursive: true });
    // Use a temp file as the confirmed-hooks store to avoid polluting real config
    confirmedStorePath = join(testDir, 'confirmed-hooks.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('isHooksConfirmed', () => {
    it('returns false when project hooks.json exists but is NOT confirmed', () => {
      const filePath = writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      const confirmed = isHooksConfirmed(filePath, confirmedStorePath);
      expect(confirmed).toBe(false);
    });

    it('returns true when project hooks.json IS confirmed (hash matches)', () => {
      const filePath = writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      // Confirm it first
      confirmHooks(filePath, confirmedStorePath);

      const confirmed = isHooksConfirmed(filePath, confirmedStorePath);
      expect(confirmed).toBe(true);
    });

    it('returns false when hooks.json content changes after confirmation', () => {
      const filePath = writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      // Confirm with original content
      confirmHooks(filePath, confirmedStorePath);
      expect(isHooksConfirmed(filePath, confirmedStorePath)).toBe(true);

      // Modify content
      writeFileSync(filePath, JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'bash', command: './malicious.sh' }] },
      }));

      // Should require re-confirmation
      expect(isHooksConfirmed(filePath, confirmedStorePath)).toBe(false);
    });

    it('returns true when file does not exist (nothing to confirm)', () => {
      const nonExistentPath = join(testDir, '.frogger', 'hooks.json');
      const confirmed = isHooksConfirmed(nonExistentPath, confirmedStorePath);
      expect(confirmed).toBe(true);
    });
  });

  describe('confirmHooks', () => {
    it('stores the SHA-256 hash of the file', () => {
      const filePath = writeHooksJson(testDir, {
        hooks: { PostToolUse: [{ matcher: '*', command: 'echo done' }] },
      });

      confirmHooks(filePath, confirmedStorePath);

      const store = JSON.parse(readFileSync(confirmedStorePath, 'utf-8'));
      const fileContent = readFileSync(filePath, 'utf-8');
      const expectedHash = sha256(fileContent);

      expect(store[filePath]).toBe(expectedHash);
    });

    it('does nothing when file does not exist', () => {
      const nonExistentPath = join(testDir, '.frogger', 'hooks.json');
      confirmHooks(nonExistentPath, confirmedStorePath);
      // Should not throw, and no store file should be created
    });
  });

  describe('loadHooksConfig with confirmation', () => {
    it('skips unconfirmed project hooks and sets needsConfirmation', () => {
      writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      const result = loadHooksConfig(testDir, { confirmedHooksPath: confirmedStorePath });

      // Project hooks should be skipped
      expect(result.hooks.PreToolUse).toEqual([]);
      expect(result.hooks.PostToolUse).toEqual([]);
      // needsConfirmation should indicate the unconfirmed file
      expect(result.needsConfirmation).toBeDefined();
      expect(result.needsConfirmation!.filePath).toContain('hooks.json');
    });

    it('loads confirmed project hooks normally', () => {
      const filePath = writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      // Confirm first
      confirmHooks(filePath, confirmedStorePath);

      const result = loadHooksConfig(testDir, { confirmedHooksPath: confirmedStorePath });

      expect(result.hooks.PreToolUse).toHaveLength(1);
      expect(result.hooks.PreToolUse[0].matcher).toBe('bash');
      expect(result.needsConfirmation).toBeUndefined();
    });

    it('loads without confirmation check when no options provided (backwards compat)', () => {
      writeHooksJson(testDir, {
        hooks: { PreToolUse: [{ matcher: 'bash', command: './check.sh' }] },
      });

      // Without options — behaves like before (no confirmation check)
      const result = loadHooksConfig(testDir);

      expect(result.hooks.PreToolUse).toHaveLength(1);
      expect(result.needsConfirmation).toBeUndefined();
    });
  });
});
