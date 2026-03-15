import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitStatusMetadata: ToolMetadata = {
  name: 'git-status',
  description: 'Show git working tree status',
  permissionLevel: 'auto',
  category: 'git',
  hints: 'Check working tree status before commits.',
};

export function createGitStatusTool(workingDirectory: string) {
  return tool({
    description: gitStatusMetadata.description,
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const result = await execa('git', ['status', '--porcelain'], {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error: ${result.stderr || 'Not a git repository'}`;
        }
        return result.stdout || '(clean working tree)';
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
