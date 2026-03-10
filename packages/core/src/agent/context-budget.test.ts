import { describe, it, expect } from 'vitest';
import { ContextBudgetTracker } from './context-budget.js';
import type { ModelInfo } from '@frogger/shared';
import type { ModelMessage } from 'ai';

const testModel: ModelInfo = {
  name: 'test-model',
  contextWindow: 10000,
  maxOutputTokens: 2000,
};

describe('ContextBudgetTracker', () => {
  it('evaluates empty messages as 0 usage', () => {
    const tracker = new ContextBudgetTracker(testModel);
    const budget = tracker.evaluate([]);
    expect(budget.currentUsage).toBe(0);
    expect(budget.usagePercent).toBe(0);
    expect(budget.shouldCompact).toBe(false);
  });

  it('calculates availableInput as (contextWindow - maxOutput) * 0.9', () => {
    const tracker = new ContextBudgetTracker(testModel);
    const budget = tracker.evaluate([]);
    // (10000 - 2000) * 0.9 = 7200
    expect(budget.availableInput).toBe(7200);
  });

  it('includes system prompt in usage estimation', () => {
    const tracker = new ContextBudgetTracker(testModel);
    const budgetNoPrompt = tracker.evaluate([]);
    const budgetWithPrompt = tracker.evaluate([], 'A system prompt with some text');
    expect(budgetWithPrompt.currentUsage).toBeGreaterThan(budgetNoPrompt.currentUsage);
  });

  it('reports shouldCompact when threshold exceeded', () => {
    const smallModel: ModelInfo = {
      name: 'small',
      contextWindow: 100,
      maxOutputTokens: 10,
    };
    const tracker = new ContextBudgetTracker(smallModel, 50);
    // availableInput = (100 - 10) * 0.9 = 81
    // Need ~41 tokens to exceed 50% → lots of messages
    const messages: ModelMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: `Message number ${i} with some extra text to fill up tokens`,
    }));
    const budget = tracker.evaluate(messages);
    expect(budget.shouldCompact).toBe(true);
  });

  it('clamps threshold between 10 and 100', () => {
    const tracker = new ContextBudgetTracker(testModel);
    tracker.setCompactThreshold(5);
    expect(tracker.getCompactThreshold()).toBe(10);
    tracker.setCompactThreshold(150);
    expect(tracker.getCompactThreshold()).toBe(100);
  });

  it('setModelInfo updates model info for evaluation', () => {
    const tracker = new ContextBudgetTracker(testModel);
    const budget1 = tracker.evaluate([]);
    expect(budget1.contextWindow).toBe(10000);

    const newModel: ModelInfo = { name: 'big', contextWindow: 200000, maxOutputTokens: 16384 };
    tracker.setModelInfo(newModel);
    const budget2 = tracker.evaluate([]);
    expect(budget2.contextWindow).toBe(200000);
  });

  it('caps usagePercent at 100', () => {
    const tinyModel: ModelInfo = { name: 'tiny', contextWindow: 20, maxOutputTokens: 5 };
    const tracker = new ContextBudgetTracker(tinyModel);
    // availableInput = (20 - 5) * 0.9 = 13
    const messages: ModelMessage[] = Array.from({ length: 10 }, () => ({
      role: 'user' as const,
      content: 'This is a long message that will exceed the tiny context window easily',
    }));
    const budget = tracker.evaluate(messages);
    expect(budget.usagePercent).toBe(100);
  });
});
