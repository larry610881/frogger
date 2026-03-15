import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitBranchMetadata: ToolMetadata = {
  name: 'git-branch',
  description: 'Manage git branches (list, create, switch, delete)',
  permissionLevel: 'confirm',
  category: 'git',
  hints: 'Manage branches. Check current branch before switching.',
};

export function createGitBranchTool(workingDirectory: string) {
  return tool({
    description: gitBranchMetadata.description,
    inputSchema: z.object({
      action: z.enum(['list', 'create', 'switch', 'delete']).describe('Branch action to perform'),
      name: z.string().optional().describe('Branch name (required for create/switch/delete)'),
      startPoint: z.string().optional().describe('Start point for create (commit, branch, or tag)'),
    }),
    execute: async ({ action, name, startPoint }) => {
      try {
        if (action !== 'list') {
          if (!name) {
            return `Error: branch name is required for '${action}' action.`;
          }
          // Prevent flag injection
          if (name.startsWith('-')) {
            return 'Error: branch name cannot start with "-".';
          }
        }

        let args: string[];
        switch (action) {
          case 'list':
            args = ['branch', '-a', '-v'];
            break;
          case 'create':
            args = ['branch', name!];
            if (startPoint) args.push(startPoint);
            break;
          case 'switch':
            args = ['switch', name!];
            break;
          case 'delete':
            // Only -d (safe delete), never -D (force delete)
            args = ['branch', '-d', name!];
            break;
        }

        const result = await execa('git', args, {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error: ${result.stderr}`;
        }
        return result.stdout || `Branch '${action}' completed successfully.`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
