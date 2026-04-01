import { describe, it, expect } from 'vitest';
import { createSwitchModeTool, SWITCH_MODE_SENTINEL, switchModeMetadata } from '../switch-mode.js';

describe('createSwitchModeTool', () => {
  const tool = createSwitchModeTool();

  it('returns sentinel string with targetMode and reason', async () => {
    const result = await tool.execute(
      { targetMode: 'plan', reason: 'Task is complex' },
      { toolCallId: 'test', messages: [], abortSignal: undefined as never },
    );
    expect(result).toBe(`${SWITCH_MODE_SENTINEL}:plan:Task is complex`);
  });

  it('works with agent as targetMode', async () => {
    const result = await tool.execute(
      { targetMode: 'agent', reason: 'User wants code changes' },
      { toolCallId: 'test', messages: [], abortSignal: undefined as never },
    );
    expect(result).toBe(`${SWITCH_MODE_SENTINEL}:agent:User wants code changes`);
  });

  it('has correct metadata', () => {
    expect(switchModeMetadata.name).toBe('switch-mode');
    expect(switchModeMetadata.permissionLevel).toBe('auto');
    expect(switchModeMetadata.category).toBe('mode');
  });
});
