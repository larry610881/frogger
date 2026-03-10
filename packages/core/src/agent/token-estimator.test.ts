import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateMessagesTokens } from './token-estimator.js';
import type { ModelMessage } from 'ai';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ASCII text at ~4 chars/token', () => {
    const text = 'Hello world'; // 11 chars → ceil(11/4) = 3
    expect(estimateTokens(text)).toBe(3);
  });

  it('estimates CJK text at ~1.5 chars/token', () => {
    const text = '你好世界'; // 4 CJK chars → ceil(4/1.5) = 3
    expect(estimateTokens(text)).toBe(3);
  });

  it('handles mixed CJK and ASCII', () => {
    const text = 'Hello 你好'; // 6 ASCII + 2 CJK → ceil(6/4) + ceil(2/1.5) = 2 + 2 = 4
    expect(estimateTokens(text)).toBe(4);
  });

  it('estimates code content', () => {
    const code = 'function foo() { return bar; }'; // 30 chars → ceil(30/4) = 8
    expect(estimateTokens(code)).toBe(8);
  });
});

describe('estimateMessagesTokens', () => {
  it('returns 0 for empty array', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it('adds message overhead per message', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: '' },
    ];
    // 4 overhead + 0 content = 4
    expect(estimateMessagesTokens(messages)).toBe(4);
  });

  it('estimates tokens for string content messages', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Hello world' }, // 4 + 3 = 7
      { role: 'assistant', content: 'Hi there' }, // 4 + 2 = 6
    ];
    expect(estimateMessagesTokens(messages)).toBe(13);
  });

  it('handles multi-part content', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text' as const, text: 'Hello world' }],
      },
    ];
    // 4 overhead + 3 content = 7
    expect(estimateMessagesTokens(messages)).toBe(7);
  });
});
