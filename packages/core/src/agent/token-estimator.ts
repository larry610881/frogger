import type { ModelMessage } from 'ai';

// CJK Unicode ranges
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\uac00-\ud7af]/g;

/**
 * Estimate token count for a string.
 * Conservative (overestimates): ~4 chars/token for ASCII, ~1.5 chars/token for CJK.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches?.length ?? 0;
  const nonCjkCount = text.length - cjkCount;

  // CJK: ~1.5 chars per token (conservative), ASCII/code: ~4 chars per token
  const cjkTokens = Math.ceil(cjkCount / 1.5);
  const nonCjkTokens = Math.ceil(nonCjkCount / 4);

  return cjkTokens + nonCjkTokens;
}

/** Per-message overhead for role markers, formatting etc. */
const MESSAGE_OVERHEAD = 4;

/**
 * Estimate total tokens for an array of messages.
 * Adds per-message overhead for role markers.
 */
export function estimateMessagesTokens(messages: ModelMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += MESSAGE_OVERHEAD;
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ('text' in part && typeof part.text === 'string') {
          total += estimateTokens(part.text);
        }
      }
    }
  }
  return total;
}
