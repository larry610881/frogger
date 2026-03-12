import { describe, it, expect, vi } from 'vitest';
import { bgCommand } from '../bg.js';
import type { SlashCommandContext } from '../types.js';

const mockContext = {
  messagesRef: { current: [] },
} as unknown as SlashCommandContext;

describe('bgCommand', () => {
  it('has correct name and usage', () => {
    expect(bgCommand.name).toBe('bg');
    expect(bgCommand.usage).toContain('/bg');
  });

  it('returns error when no prompt provided', async () => {
    const result = await bgCommand.execute([], mockContext);
    expect(result.type).toBe('error');
    expect(result.message).toContain('prompt');
  });

  it('returns error when no backgroundTaskManager in context', async () => {
    const result = await bgCommand.execute(['do', 'something'], mockContext);
    expect(result.type).toBe('error');
    expect(result.message).toContain('not available');
  });

  it('starts a task when manager and createBackgroundAgent are available', async () => {
    const mockStart = vi.fn().mockReturnValue('bg-1');
    const ctx = {
      ...mockContext,
      backgroundTaskManager: { start: mockStart },
      createBackgroundAgent: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as SlashCommandContext;

    const result = await bgCommand.execute(['fix', 'the', 'bug'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('bg-1');
    expect(mockStart).toHaveBeenCalledWith('fix the bug', expect.objectContaining({ run: expect.any(Function) }));
  });

  it('returns error when createBackgroundAgent is missing', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: { start: vi.fn() },
    } as unknown as SlashCommandContext;

    const result = await bgCommand.execute(['fix', 'bug'], ctx);
    expect(result.type).toBe('error');
  });
});
