import { NOTIFICATION_MIN_DURATION_MS } from '@frogger/shared';

export interface NotifyOptions {
  title: string;
  message: string;
}

/**
 * Send a desktop notification. Uses BEL character (zero-dependency, works in all terminals)
 * and optionally uses node-notifier for richer notifications if installed.
 */
export async function sendNotification({ title, message }: NotifyOptions): Promise<void> {
  // BEL character — always ring the terminal bell
  process.stderr.write('\x07');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifier = await (Function('return import("node-notifier")')() as Promise<{ default: { notify: (opts: { title: string; message: string; sound: boolean }) => void } }>);
    notifier.default.notify({ title, message, sound: true });
  } catch {
    // node-notifier not installed — BEL already sent, graceful fallback
  }
}

/**
 * Determine whether a notification should be sent based on elapsed time.
 */
export function shouldNotify(elapsedMs: number, minDurationMs = NOTIFICATION_MIN_DURATION_MS): boolean {
  return elapsedMs >= minDurationMs;
}

/**
 * Format a human-readable notification message from task stats.
 */
export function formatNotificationMessage(elapsedMs: number, tokens?: { totalTokens?: number }): string {
  const secs = elapsedMs / 1000;
  const time = secs >= 60
    ? `${Math.floor(secs / 60)}m${Math.round(secs % 60)}s`
    : `${secs.toFixed(1)}s`;

  const parts = [`Completed in ${time}`];
  if (tokens?.totalTokens) {
    parts.push(`${tokens.totalTokens.toLocaleString()} tokens`);
  }
  return parts.join(' | ');
}
