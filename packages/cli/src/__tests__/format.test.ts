import { describe, it, expect } from 'vitest';
import { calculateCost } from '../utils/format.js';

describe('calculateCost', () => {
  it('returns correct cost for DeepSeek model', () => {
    // deepseek-chat: input $0.27/1M, output $1.10/1M
    const cost = calculateCost(1_000_000, 1_000_000, 'deepseek-chat');
    expect(cost).toBeCloseTo(0.27 + 1.10);
  });

  it('returns correct cost for Anthropic model', () => {
    // claude-sonnet-4: input $3.00/1M, output $15.00/1M
    const cost = calculateCost(1_000_000, 500_000, 'claude-sonnet-4-20250514');
    expect(cost).toBeCloseTo(3.00 + 7.50);
  });

  it('returns correct cost for OpenAI model', () => {
    // gpt-4o: input $2.50/1M, output $10.00/1M
    const cost = calculateCost(2_000_000, 100_000, 'gpt-4o');
    expect(cost).toBeCloseTo(5.00 + 1.00);
  });

  it('returns null for unknown model', () => {
    const cost = calculateCost(1_000_000, 1_000_000, 'unknown-model');
    expect(cost).toBeNull();
  });

  it('returns $0.00 for 0 tokens', () => {
    const cost = calculateCost(0, 0, 'deepseek-chat');
    expect(cost).toBe(0);
  });

  it('includes reasoning tokens at output pricing', () => {
    // claude-sonnet-4: output $15.00/1M
    // 1M completion + 500K reasoning = 1.5M output tokens
    const cost = calculateCost(1_000_000, 1_000_000, 'claude-sonnet-4-20250514', {
      reasoningTokens: 500_000,
    });
    // input: 1M * $3.00/1M = $3.00
    // output: (1M + 500K) * $15.00/1M = $22.50
    expect(cost).toBeCloseTo(3.00 + 22.50);
  });

  it('calculates cache read tokens at 10% input price', () => {
    // claude-sonnet-4: input $3.00/1M
    // 1M prompt with 500K from cache read
    const cost = calculateCost(1_000_000, 100_000, 'claude-sonnet-4-20250514', {
      cacheReadTokens: 500_000,
    });
    // regular prompt: (1M - 500K) * $3.00/1M = $1.50
    // cache read: 500K * $3.00/1M * 0.1 = $0.15
    // output: 100K * $15.00/1M = $1.50
    expect(cost).toBeCloseTo(1.50 + 0.15 + 1.50);
  });

  it('calculates cache creation tokens at 125% input price', () => {
    // claude-sonnet-4: input $3.00/1M
    const cost = calculateCost(1_000_000, 100_000, 'claude-sonnet-4-20250514', {
      cacheCreationTokens: 200_000,
    });
    // regular prompt: (1M - 200K) * $3.00/1M = $2.40
    // cache creation: 200K * $3.00/1M * 1.25 = $0.75
    // output: 100K * $15.00/1M = $1.50
    expect(cost).toBeCloseTo(2.40 + 0.75 + 1.50);
  });

  it('handles combined reasoning + cache tokens', () => {
    const cost = calculateCost(1_000_000, 500_000, 'claude-sonnet-4-20250514', {
      reasoningTokens: 200_000,
      cacheReadTokens: 400_000,
      cacheCreationTokens: 100_000,
    });
    // regular prompt: (1M - 400K - 100K) * $3.00/1M = $1.50
    // cache read: 400K * $3.00/1M * 0.1 = $0.12
    // cache creation: 100K * $3.00/1M * 1.25 = $0.375
    // output: (500K + 200K) * $15.00/1M = $10.50
    expect(cost).toBeCloseTo(1.50 + 0.12 + 0.375 + 10.50);
  });
});
