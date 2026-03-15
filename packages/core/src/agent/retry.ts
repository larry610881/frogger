/**
 * Retry utilities for transient LLM API errors.
 *
 * Only retries when the stream has NOT yet yielded any events
 * (hasYielded === false), so the UI never sees partial/duplicate data.
 */

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);

export interface RetryOptions {
  /** Maximum number of retry attempts (excluding the initial try). Default: 3 */
  maxRetries: number;
  /** Base delay in ms before first retry. Default: 1000 */
  baseDelayMs: number;
  /** Maximum delay cap in ms. Default: 30000 */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Determine whether an error is transient and safe to retry.
 *
 * Retryable: 429, 500, 502, 503, ECONNRESET, ETIMEDOUT, ENOTFOUND
 * Non-retryable: 400, 401, 403, AbortError, and anything else
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // AbortError — user cancelled, never retry
  if ((error as Error).name === 'AbortError') return false;

  // HTTP status code (Vercel AI SDK wraps status in various places)
  const status = (error as Record<string, unknown>).status ??
    (error as Record<string, unknown>).statusCode;
  if (typeof status === 'number') {
    return RETRYABLE_STATUS_CODES.has(status);
  }

  // Node.js network error codes
  const code = (error as Record<string, unknown>).code;
  if (typeof code === 'string') {
    return RETRYABLE_ERROR_CODES.has(code);
  }

  // Check error message as last resort
  const message = (error as Error).message ?? '';
  if (/rate.?limit|too many requests|429/i.test(message)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(message)) return true;

  return false;
}

/**
 * Calculate exponential backoff delay with jitter.
 *
 * delay = min(baseDelay * 2^attempt + random(0, baseDelay), maxDelay)
 */
export function calculateDelay(
  attempt: number,
  options: Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs'> = DEFAULT_RETRY_OPTIONS,
): number {
  const { baseDelayMs, maxDelayMs } = options;
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponential + jitter, maxDelayMs);
}

/**
 * Sleep for the given duration, respecting an optional AbortSignal.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
