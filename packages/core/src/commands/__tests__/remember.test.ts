import { describe, it, expect } from 'vitest';
import { rememberCommand } from '../remember.js';
import type { SlashCommandContext } from '../types.js';

describe('rememberCommand (/remember)', () => {
  it('returns usage message when no args', () => {
    const ctx = {
      messagesRef: { current: [] },
    } as unknown as SlashCommandContext;

    const result = rememberCommand.execute([], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('Usage');
    expect(result.message).toContain('/remember');
  });

  it('pushes user message and returns confirmation', () => {
    const messages: unknown[] = [];
    const ctx = {
      messagesRef: { current: messages },
    } as unknown as SlashCommandContext;

    const result = rememberCommand.execute(['always', 'use', 'pnpm'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('Saving memory');
    expect(messages).toHaveLength(1);
    expect((messages[0] as { role: string; content: string }).role).toBe('user');
    expect((messages[0] as { role: string; content: string }).content).toContain('always use pnpm');
  });
});
