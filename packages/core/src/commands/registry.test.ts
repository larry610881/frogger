import { describe, it, expect } from 'vitest';
import { CommandRegistry } from './registry.js';
import type { SlashCommand, SlashCommandContext } from './types.js';

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

describe('CommandRegistry', () => {
  it('isCommand detects slash commands', () => {
    const registry = new CommandRegistry();
    expect(registry.isCommand('/help')).toBe(true);
    expect(registry.isCommand('/clear')).toBe(true);
    expect(registry.isCommand('hello')).toBe(false);
    expect(registry.isCommand(' /help')).toBe(true);
  });

  it('/help lists registered commands', async () => {
    const registry = new CommandRegistry();
    const testCmd: SlashCommand = {
      name: 'test',
      description: 'A test command',
      usage: '/test',
      execute: () => ({ type: 'message', message: 'ok' }),
    };
    registry.register(testCmd);

    const result = await registry.execute('/help', makeContext());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('message');
    expect(result!.message).toContain('/test');
    expect(result!.message).toContain('A test command');
  });

  it('executes registered command', async () => {
    const registry = new CommandRegistry();
    const testCmd: SlashCommand = {
      name: 'test',
      description: 'A test command',
      usage: '/test',
      execute: (args) => ({ type: 'message', message: `args: ${args.join(',')}` }),
    };
    registry.register(testCmd);

    const result = await registry.execute('/test foo bar', makeContext());
    expect(result).not.toBeNull();
    expect(result!.message).toBe('args: foo,bar');
  });

  it('returns error for unknown command', async () => {
    const registry = new CommandRegistry();
    const result = await registry.execute('/unknown', makeContext());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('error');
    expect(result!.message).toContain('Unknown command');
  });

  it('returns null for non-command input', async () => {
    const registry = new CommandRegistry();
    const result = await registry.execute('hello', makeContext());
    expect(result).toBeNull();
  });
});
