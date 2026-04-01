import { tool } from 'ai';
import { z } from 'zod';
import type { ToolMetadata } from '@frogger/shared';

export const SWITCH_MODE_SENTINEL = 'MODE_SWITCH_REQUESTED';

export const switchModeMetadata: ToolMetadata = {
  name: 'switch-mode',
  description: `Switch to a different mode. Use this proactively when:
- Switch to "plan" when the task is complex and needs architectural planning before implementation.
- Switch to "agent" when the user wants code changes, file modifications, or git operations.
You must provide a reason explaining why the mode switch is appropriate.`,
  permissionLevel: 'auto',
  category: 'mode',
  hints: 'Switch modes when the current mode lacks the tools needed for the task.',
};

export function createSwitchModeTool() {
  return tool({
    description: switchModeMetadata.description,
    inputSchema: z.object({
      targetMode: z.enum(['plan', 'agent']).describe(
        'The mode to switch to. "plan" for architectural planning (read-only). "agent" for full access (read/write/git/bash).',
      ),
      reason: z.string().describe('Why this mode switch is needed.'),
    }),
    execute: async ({ targetMode, reason }) => {
      return `${SWITCH_MODE_SENTINEL}:${targetMode}:${reason}`;
    },
  });
}
