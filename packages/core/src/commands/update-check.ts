import { APP_VERSION, APP_NAME } from '@frogger/shared';
import type { SlashCommand } from './types.js';

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateCommand: string;
}

/**
 * Check npm registry for the latest published version.
 * Uses the abbreviated registry metadata endpoint (lightweight, no auth needed).
 */
export async function checkForUpdate(
  packageName = APP_NAME,
  currentVersion = APP_VERSION,
  timeoutMs = 5000,
): Promise<UpdateCheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}`);
    }

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;

    return {
      currentVersion,
      latestVersion,
      updateAvailable: isNewerVersion(currentVersion, latestVersion),
      updateCommand: `npm install -g ${packageName}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compare two semver versions. Returns true if `latest` is newer than `current`.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [cMajor = 0, cMinor = 0, cPatch = 0] = parse(current);
  const [lMajor = 0, lMinor = 0, lPatch = 0] = parse(latest);

  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}

/**
 * Format a human-readable update notification.
 */
export function formatUpdateMessage(result: UpdateCheckResult): string {
  if (!result.updateAvailable) return '';
  return `Update available: ${result.currentVersion} → ${result.latestVersion}\nRun: ${result.updateCommand}`;
}

export const updateCheckCommand: SlashCommand = {
  name: 'update',
  description: 'Check for updates to Frogger',
  usage: '/update',

  async execute() {
    try {
      const result = await checkForUpdate();
      if (result.updateAvailable) {
        return {
          type: 'message',
          message: `Update available! ${result.currentVersion} → ${result.latestVersion}\n\nRun to update:\n  ${result.updateCommand}`,
        };
      }
      return {
        type: 'message',
        message: `You're on the latest version (${result.currentVersion}).`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: 'error',
        message: `Could not check for updates: ${message}`,
      };
    }
  },
};
