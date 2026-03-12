import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRetryableError, calculateDelay, sleep } from '../retry.js';

describe('isRetryableError', () => {
  it('returns true for HTTP 429', () => {
    expect(isRetryableError({ status: 429, message: 'Too Many Requests' })).toBe(true);
  });

  it('returns true for HTTP 500', () => {
    expect(isRetryableError({ status: 500, message: 'Internal Server Error' })).toBe(true);
  });

  it('returns true for HTTP 502', () => {
    expect(isRetryableError({ status: 502, message: 'Bad Gateway' })).toBe(true);
  });

  it('returns true for HTTP 503', () => {
    expect(isRetryableError({ status: 503, message: 'Service Unavailable' })).toBe(true);
  });

  it('returns true for statusCode field', () => {
    expect(isRetryableError({ statusCode: 429 })).toBe(true);
  });

  it('returns false for HTTP 400', () => {
    expect(isRetryableError({ status: 400, message: 'Bad Request' })).toBe(false);
  });

  it('returns false for HTTP 401', () => {
    expect(isRetryableError({ status: 401, message: 'Unauthorized' })).toBe(false);
  });

  it('returns false for HTTP 403', () => {
    expect(isRetryableError({ status: 403, message: 'Forbidden' })).toBe(false);
  });

  it('returns false for AbortError', () => {
    const err = new DOMException('Aborted', 'AbortError');
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns true for ECONNRESET', () => {
    const err = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    const err = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for ENOTFOUND', () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true when message contains rate limit hint', () => {
    expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isRetryableError('error')).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isRetryableError(new Error('something went wrong'))).toBe(false);
  });
});

describe('calculateDelay', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('returns exponential backoff with jitter', () => {
    // attempt 0: 1000 * 2^0 + 0.5 * 1000 = 1500
    expect(calculateDelay(0, { baseDelayMs: 1000, maxDelayMs: 30000 })).toBe(1500);
  });

  it('increases delay with each attempt', () => {
    const delay0 = calculateDelay(0, { baseDelayMs: 1000, maxDelayMs: 30000 });
    const delay1 = calculateDelay(1, { baseDelayMs: 1000, maxDelayMs: 30000 });
    const delay2 = calculateDelay(2, { baseDelayMs: 1000, maxDelayMs: 30000 });
    expect(delay1).toBeGreaterThan(delay0);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it('caps at maxDelayMs', () => {
    // attempt 10: 1000 * 2^10 = 1,024,000 — should be capped at 30000
    const delay = calculateDelay(10, { baseDelayMs: 1000, maxDelayMs: 30000 });
    expect(delay).toBe(30000);
  });

  it('uses default options when not provided', () => {
    const delay = calculateDelay(0);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(30000);
  });
});

describe('sleep', () => {
  it('resolves after the given duration', async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await promise; // should resolve without error
    vi.useRealTimers();
  });

  it('rejects immediately if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toThrow();
  });

  it('rejects when signal is aborted during sleep', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = sleep(10000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});
