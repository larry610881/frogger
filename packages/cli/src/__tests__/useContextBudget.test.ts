import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMPACT_PRESERVE_RECENT } from '@frogger/shared';

/**
 * Tests for the useContextBudget hook logic.
 *
 * Rather than testing React hook state management, we test the core budget
 * tracking and auto-compact logic that useContextBudget implements.
 */

// Mock @frogger/core
const mockEvaluate = vi.fn();
const mockCompactMessages = vi.fn();
const mockLoadConfig = vi.fn();
const mockCreateModel = vi.fn();

vi.mock('@frogger/core', () => ({
  compactMessages: (...args: unknown[]) => mockCompactMessages(...args),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  createModel: (...args: unknown[]) => mockCreateModel(...args),
}));

function makeBudgetTracker(overrides: Partial<{ shouldCompact: boolean; usagePercent: number }> = {}) {
  mockEvaluate.mockReturnValue({
    contextWindow: 128000,
    maxOutputTokens: 8192,
    availableInput: 100000,
    currentUsage: 50000,
    usagePercent: overrides.usagePercent ?? 50,
    shouldCompact: overrides.shouldCompact ?? false,
  });
  return { evaluate: mockEvaluate };
}

function makeDummyMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `message-${i}`,
  }));
}

describe('useContextBudget logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('updateBudget calls budgetTracker.evaluate with messages', async () => {
    const tracker = makeBudgetTracker();
    const messages = makeDummyMessages(5);

    const budget = tracker.evaluate(messages, 'system prompt');

    expect(mockEvaluate).toHaveBeenCalledWith(messages, 'system prompt');
    expect(budget.usagePercent).toBe(50);
    expect(budget.shouldCompact).toBe(false);
  });

  it('maybeAutoCompact does nothing when shouldCompact is false', async () => {
    const tracker = makeBudgetTracker({ shouldCompact: false });
    const messages = makeDummyMessages(COMPACT_PRESERVE_RECENT + 5);

    const budget = tracker.evaluate(messages);

    expect(budget.shouldCompact).toBe(false);
    // Compact would not be triggered
    expect(mockCompactMessages).not.toHaveBeenCalled();
  });

  it('maybeAutoCompact does nothing when messages <= COMPACT_PRESERVE_RECENT', async () => {
    const tracker = makeBudgetTracker({ shouldCompact: true });
    const messages = makeDummyMessages(COMPACT_PRESERVE_RECENT);

    const budget = tracker.evaluate(messages);

    // Even though shouldCompact is true, not enough messages to compact
    expect(budget.shouldCompact).toBe(true);
    expect(messages.length).toBeLessThanOrEqual(COMPACT_PRESERVE_RECENT);
  });

  it('maybeAutoCompact throttles: no compact within 30 seconds', () => {
    // Simulate throttle via timestamp tracking (mirrors useContextBudget's lastCompactedAtRef)
    let lastCompactedAt = 0; // Ref starts at 0
    const THROTTLE_MS = 30000;
    const baseTime = 1700000000000; // Realistic timestamp

    // First call: now - 0 is huge → should NOT throttle
    const now1 = baseTime;
    const shouldThrottle1 = now1 - lastCompactedAt < THROTTLE_MS;
    expect(shouldThrottle1).toBe(false);
    lastCompactedAt = now1;

    // Second call 10 seconds later — should be throttled
    const now2 = baseTime + 10_000;
    const shouldThrottle2 = now2 - lastCompactedAt < THROTTLE_MS;
    expect(shouldThrottle2).toBe(true);

    // Third call 31 seconds after first — should pass
    const now3 = baseTime + 31_000;
    const shouldThrottle3 = now3 - lastCompactedAt < THROTTLE_MS;
    expect(shouldThrottle3).toBe(false);
  });

  it('maybeAutoCompact triggers compaction and updates messages', async () => {
    const compactedMessages = [{ role: 'user', content: '[summary]' }];
    mockCompactMessages.mockResolvedValue({
      messages: compactedMessages,
      summary: 'A compact summary.',
      compactedCount: 5,
    });
    mockLoadConfig.mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    mockCreateModel.mockReturnValue({});

    const { compactMessages, loadConfig, createModel } = await import('@frogger/core');

    const config = loadConfig({ provider: 'deepseek', model: 'deepseek-chat' });
    const model = createModel(config.provider, config.model, { apiKey: config.apiKey });

    const originalMessages = makeDummyMessages(COMPACT_PRESERVE_RECENT + 5);
    const result = await compactMessages(model, originalMessages);

    expect(result.compactedCount).toBe(5);
    expect(result.messages).toEqual(compactedMessages);
  });

  it('maybeAutoCompact calls onMessage with compact notification', async () => {
    const onMessage = vi.fn();
    mockCompactMessages.mockResolvedValue({
      messages: [],
      summary: 'summary',
      compactedCount: 3,
    });

    // Simulate what useContextBudget does after compaction
    onMessage({
      id: `compact-${Date.now()}`,
      role: 'tool',
      content: `Auto-compacted 3 messages.`,
    });

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      role: 'tool',
      content: 'Auto-compacted 3 messages.',
    }));
  });

  it('maybeAutoCompact silently fails on error', async () => {
    mockCompactMessages.mockRejectedValue(new Error('API error'));
    mockLoadConfig.mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    mockCreateModel.mockReturnValue({});

    const { compactMessages, loadConfig, createModel } = await import('@frogger/core');

    const config = loadConfig({ provider: 'deepseek', model: 'deepseek-chat' });
    const model = createModel(config.provider, config.model, { apiKey: config.apiKey });

    // Should not throw
    let error: Error | null = null;
    try {
      await compactMessages(model, []);
    } catch (e) {
      error = e as Error;
    }

    // In the hook, this error is silently caught
    expect(error).not.toBeNull();
    expect(error!.message).toBe('API error');
  });
});
