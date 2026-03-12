import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldNotify, formatNotificationMessage, sendNotification } from '../utils/notify.js';
import { NOTIFICATION_MIN_DURATION_MS } from '@frogger/shared';

describe('shouldNotify', () => {
  it('returns false when elapsed is below threshold', () => {
    expect(shouldNotify(5_000)).toBe(false);
  });

  it('returns true when elapsed equals threshold', () => {
    expect(shouldNotify(NOTIFICATION_MIN_DURATION_MS)).toBe(true);
  });

  it('returns true when elapsed exceeds threshold', () => {
    expect(shouldNotify(30_000)).toBe(true);
  });

  it('respects custom minDurationMs', () => {
    expect(shouldNotify(3_000, 5_000)).toBe(false);
    expect(shouldNotify(5_000, 5_000)).toBe(true);
  });
});

describe('formatNotificationMessage', () => {
  it('formats seconds correctly', () => {
    const msg = formatNotificationMessage(25_000);
    expect(msg).toBe('Completed in 25.0s');
  });

  it('formats minutes correctly', () => {
    const msg = formatNotificationMessage(90_000);
    expect(msg).toBe('Completed in 1m30s');
  });

  it('includes token count when provided', () => {
    const msg = formatNotificationMessage(20_000, { totalTokens: 5000 });
    expect(msg).toContain('5,000 tokens');
  });

  it('omits token count when zero', () => {
    const msg = formatNotificationMessage(20_000, { totalTokens: 0 });
    expect(msg).toBe('Completed in 20.0s');
  });
});

describe('sendNotification', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('writes BEL character to stderr', async () => {
    await sendNotification({ title: 'Test', message: 'Hello' });
    expect(stderrSpy).toHaveBeenCalledWith('\x07');
  });

  it('does not throw when node-notifier is not installed', async () => {
    await expect(
      sendNotification({ title: 'Test', message: 'Hello' }),
    ).resolves.toBeUndefined();
  });
});
