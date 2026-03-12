import { describe, it, expect, vi } from 'vitest';
import { tasksCommand, taskCommand } from '../tasks.js';
import type { SlashCommandContext } from '../types.js';

const mockContext = {
  messagesRef: { current: [] },
} as unknown as SlashCommandContext;

describe('tasksCommand (/tasks)', () => {
  it('has correct name', () => {
    expect(tasksCommand.name).toBe('tasks');
  });

  it('returns error when no backgroundTaskManager', async () => {
    const result = await tasksCommand.execute([], mockContext);
    expect(result.type).toBe('error');
  });

  it('shows empty list', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        list: vi.fn().mockReturnValue([]),
      },
    } as unknown as SlashCommandContext;

    const result = await tasksCommand.execute([], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('No background tasks');
  });

  it('lists running and completed tasks', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        list: vi.fn().mockReturnValue([
          { id: 'bg-1', prompt: 'fix bug', status: 'running', startedAt: Date.now() },
          { id: 'bg-2', prompt: 'add tests', status: 'completed', startedAt: Date.now() - 5000, completedAt: Date.now() },
        ]),
      },
    } as unknown as SlashCommandContext;

    const result = await tasksCommand.execute([], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('bg-1');
    expect(result.message).toContain('fix bug');
    expect(result.message).toContain('bg-2');
  });
});

describe('taskCommand (/task)', () => {
  it('has correct name', () => {
    expect(taskCommand.name).toBe('task');
  });

  it('returns error when no args', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: { get: vi.fn(), cancel: vi.fn() },
    } as unknown as SlashCommandContext;

    const result = await taskCommand.execute([], ctx);
    expect(result.type).toBe('error');
  });

  it('shows task details by id', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        get: vi.fn().mockReturnValue({
          id: 'bg-1',
          prompt: 'fix bug',
          status: 'running',
          startedAt: Date.now(),
        }),
      },
    } as unknown as SlashCommandContext;

    const result = await taskCommand.execute(['bg-1'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('bg-1');
    expect(result.message).toContain('fix bug');
  });

  it('cancels a task with cancel subcommand', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        cancel: vi.fn().mockReturnValue(true),
      },
    } as unknown as SlashCommandContext;

    const result = await taskCommand.execute(['cancel', 'bg-1'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('cancelled');
    expect(ctx.backgroundTaskManager!.cancel).toHaveBeenCalledWith('bg-1');
  });

  it('returns error when cancelling non-existent task', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        cancel: vi.fn().mockReturnValue(false),
      },
    } as unknown as SlashCommandContext;

    const result = await taskCommand.execute(['cancel', 'bg-99'], ctx);
    expect(result.type).toBe('error');
  });

  it('returns error for unknown task id', async () => {
    const ctx = {
      ...mockContext,
      backgroundTaskManager: {
        get: vi.fn().mockReturnValue(undefined),
      },
    } as unknown as SlashCommandContext;

    const result = await taskCommand.execute(['bg-99'], ctx);
    expect(result.type).toBe('error');
  });
});
