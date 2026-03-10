import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitLogMetadata: ToolMetadata = {
  name: 'git-log',
  description: 'Show recent git commit history',
  permissionLevel: 'auto',
};

export function createGitLogTool(workingDirectory: string) {
  return tool({
    description: gitLogMetadata.description,
    inputSchema: z.object({
      count: z.number().optional().describe('Number of commits to show (default 10)'),
    }),
    execute: async ({ count }) => {
      try {
        const n = Math.min(count ?? 10, 50);
        const result = await execa('git', ['log', `--oneline`, `-${n}`], {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error: ${result.stderr || 'Git log failed'}`;
        }
        return result.stdout || '(no commits)';
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
