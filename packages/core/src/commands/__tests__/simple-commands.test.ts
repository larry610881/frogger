import type { SlashCommandContext } from '../types.js';
import { clearCommand } from '../clear.js';
import { costCommand } from '../cost.js';
import { contextCommand } from '../context.js';
import { compactThresholdCommand } from '../compact-threshold.js';
import { modelCommand } from '../model.js';
import { setupCommand } from '../setup.js';

function makeContext(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
  return {
    messagesRef: { current: [] },
    budgetTracker: null,
    model: null,
    providers: [],
    currentProvider: 'deepseek',
    currentModel: 'deepseek-chat',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// /clear
// ---------------------------------------------------------------------------
describe('clearCommand', () => {
  it('clears messagesRef.current to empty array', () => {
    const ctx = makeContext({
      messagesRef: { current: [{ role: 'user', content: 'hello' } as any] },
    });

    clearCommand.execute([], ctx);

    expect(ctx.messagesRef.current).toEqual([]);
  });

  it('calls onClearHistory callback', () => {
    const onClearHistory = vi.fn();
    const ctx = makeContext({ onClearHistory });

    clearCommand.execute([], ctx);

    expect(onClearHistory).toHaveBeenCalledOnce();
  });

  it('returns a success message', () => {
    const result = clearCommand.execute([], makeContext());

    expect(result).toEqual({ type: 'message', message: 'Context cleared.' });
  });
});

// ---------------------------------------------------------------------------
// /cost
// ---------------------------------------------------------------------------
describe('costCommand', () => {
  it('returns fallback message when no sessionUsage is present', () => {
    const result = costCommand.execute([], makeContext());

    expect(result).toEqual({ type: 'message', message: 'No usage data available yet.' });
  });

  it('shows token counts when sessionUsage is provided', () => {
    const ctx = makeContext({
      sessionUsage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.0123,
      },
    });

    const result = costCommand.execute([], ctx);

    expect(result.type).toBe('message');
    expect(result.message).toContain('1,000');
    expect(result.message).toContain('500');
    expect(result.message).toContain('1,500');
  });

  it('shows estimated cost when not null, and N/A when null', () => {
    const withCost = makeContext({
      sessionUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.0042,
      },
    });
    const resultWithCost = costCommand.execute([], withCost);
    expect(resultWithCost.message).toContain('$0.0042');

    const withoutCost = makeContext({
      sessionUsage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: null,
      },
    });
    const resultNoCost = costCommand.execute([], withoutCost);
    expect(resultNoCost.message).toContain('N/A');
  });
});

// ---------------------------------------------------------------------------
// /context
// ---------------------------------------------------------------------------
describe('contextCommand', () => {
  it('returns fallback message when budgetTracker is null', () => {
    const result = contextCommand.execute([], makeContext());

    expect(result).toEqual({ type: 'message', message: 'Context tracker not available.' });
  });

  it('shows usage bar and token info when tracker exists', () => {
    const ctx = makeContext({
      budgetTracker: {
        evaluate: () => ({
          contextWindow: 128000,
          maxOutputTokens: 8192,
          availableInput: 100000,
          currentUsage: 50000,
          usagePercent: 50,
          shouldCompact: false,
        }),
        getCompactThreshold: () => 80,
        setCompactThreshold: vi.fn(),
        setModelInfo: vi.fn(),
      } as any,
    });

    const result = contextCommand.execute([], ctx);

    expect(result.type).toBe('message');
    expect(result.message).toContain('Context Window Usage:');
    expect(result.message).toContain('50%');
    expect(result.message).toContain('128,000');
    expect(result.message).toContain('~50,000');
    // Bar should contain filled and empty block characters
    expect(result.message).toMatch(/[\u2588]+[\u2591]+/);
  });

  it('clamps available tokens to 0 when usage exceeds available', () => {
    const ctx = makeContext({
      budgetTracker: {
        evaluate: () => ({
          contextWindow: 128000,
          maxOutputTokens: 8192,
          availableInput: 100000,
          currentUsage: 120000,
          usagePercent: 100,
          shouldCompact: true,
        }),
        getCompactThreshold: () => 80,
        setCompactThreshold: vi.fn(),
        setModelInfo: vi.fn(),
      } as any,
    });

    const result = contextCommand.execute([], ctx);

    expect(result.message).toContain('~0');
    // Should not contain negative token counts
    expect(result.message).not.toMatch(/~-\d/);
  });
});

// ---------------------------------------------------------------------------
// /compact-threshold
// ---------------------------------------------------------------------------
describe('compactThresholdCommand', () => {
  it('shows default threshold (80) when no args and no tracker', () => {
    const result = compactThresholdCommand.execute([], makeContext());

    expect(result).toEqual({ type: 'message', message: 'Current compact threshold: 80%' });
  });

  it('shows tracker threshold when no args and tracker exists', () => {
    const ctx = makeContext({
      budgetTracker: {
        getCompactThreshold: () => 65,
        setCompactThreshold: vi.fn(),
        evaluate: vi.fn(),
        setModelInfo: vi.fn(),
      } as any,
    });

    const result = compactThresholdCommand.execute([], ctx);

    expect(result).toEqual({ type: 'message', message: 'Current compact threshold: 65%' });
  });

  it('sets threshold with valid value', () => {
    const setCompactThreshold = vi.fn();
    const ctx = makeContext({
      budgetTracker: {
        getCompactThreshold: () => 80,
        setCompactThreshold,
        evaluate: vi.fn(),
        setModelInfo: vi.fn(),
      } as any,
    });

    const result = compactThresholdCommand.execute(['50'], ctx);

    expect(setCompactThreshold).toHaveBeenCalledWith(50);
    expect(result).toEqual({ type: 'message', message: 'Compact threshold set to 50%.' });
  });

  it('returns error for invalid values', () => {
    const ctx = makeContext();

    // NaN
    expect(compactThresholdCommand.execute(['abc'], ctx)).toEqual({
      type: 'error',
      message: 'Threshold must be a number between 10 and 100.',
    });

    // Below range
    expect(compactThresholdCommand.execute(['5'], ctx)).toEqual({
      type: 'error',
      message: 'Threshold must be a number between 10 and 100.',
    });

    // Above range
    expect(compactThresholdCommand.execute(['200'], ctx)).toEqual({
      type: 'error',
      message: 'Threshold must be a number between 10 and 100.',
    });
  });
});

// ---------------------------------------------------------------------------
// /model
// ---------------------------------------------------------------------------
describe('modelCommand', () => {
  it('returns error when no providers have API keys', () => {
    const ctx = makeContext({
      providers: [
        {
          name: 'openai',
          label: 'OpenAI',
          type: 'openai',
          envKey: 'OPENAI_API_KEY',
          models: [{ name: 'gpt-4o', contextWindow: 128000, maxOutputTokens: 16384 }],
          defaultModel: 'gpt-4o',
        },
      ],
    });

    // Ensure the env key is not set
    delete process.env['OPENAI_API_KEY'];

    const result = modelCommand.execute([], ctx);

    expect(result).toEqual({
      type: 'error',
      message: 'No providers with API keys configured. Run /setup first.',
    });
  });

  it('returns interactive choices when providers have API keys', () => {
    const testEnvKey = 'FROGGER_TEST_MODEL_KEY';
    process.env[testEnvKey] = 'test-key-value';

    const ctx = makeContext({
      currentProvider: 'test-provider',
      currentModel: 'test-model-a',
      providers: [
        {
          name: 'test-provider',
          label: 'Test Provider',
          type: 'openai-compatible',
          baseURL: 'https://example.com',
          envKey: testEnvKey,
          models: [
            { name: 'test-model-a', contextWindow: 100000, maxOutputTokens: 8192 },
            { name: 'test-model-b', contextWindow: 100000, maxOutputTokens: 8192 },
          ],
          defaultModel: 'test-model-a',
        },
      ],
    });

    const result = modelCommand.execute([], ctx);

    expect(result.type).toBe('interactive');
    expect(result.choices).toHaveLength(2);
    expect(result.choices![0]).toEqual({
      provider: 'test-provider',
      model: 'test-model-a',
      label: 'Test Provider / test-model-a (current)',
    });
    expect(result.choices![1]).toEqual({
      provider: 'test-provider',
      model: 'test-model-b',
      label: 'Test Provider / test-model-b',
    });

    // Cleanup
    delete process.env[testEnvKey];
  });
});

// ---------------------------------------------------------------------------
// /setup
// ---------------------------------------------------------------------------
describe('setupCommand', () => {
  it('calls onTriggerSetup callback', () => {
    const onTriggerSetup = vi.fn();
    const ctx = makeContext({ onTriggerSetup });

    setupCommand.execute([], ctx);

    expect(onTriggerSetup).toHaveBeenCalledOnce();
  });

  it('returns success message', () => {
    const result = setupCommand.execute([], makeContext());

    expect(result).toEqual({ type: 'message', message: 'Opening setup...' });
  });
});
