import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitInitMetadata: ToolMetadata = {
  name: 'git-init',
  description: 'Initialize a new git repository',
  permissionLevel: 'confirm',
  category: 'git',
  hints: 'Initialize new repositories.',
};

export function createGitInitTool(workingDirectory: string) {
  return tool({
    description: gitInitMetadata.description,
    inputSchema: z.object({
      defaultBranch: z.string().optional().describe('Default branch name (default: main)'),
    }),
    execute: async ({ defaultBranch }) => {
      try {
        const check = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
          cwd: workingDirectory,
          reject: false,
        });
        if (check.exitCode === 0) {
          return 'Already inside a git repository.';
        }

        const branch = defaultBranch ?? 'main';
        const result = await execa('git', ['init', '-b', branch], {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error initializing repository: ${result.stderr}`;
        }
        return result.stdout || `Initialized empty git repository with branch '${branch}'.`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
