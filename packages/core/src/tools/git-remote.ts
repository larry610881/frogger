import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

const GIT_URL_PATTERN = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/;

export const gitRemoteMetadata: ToolMetadata = {
  name: 'git-remote',
  description: 'Manage git remotes (list, add, remove, get-url)',
  permissionLevel: 'confirm',
  category: 'git',
  hints: 'Manage remote repositories.',
};

export function createGitRemoteTool(workingDirectory: string) {
  return tool({
    description: gitRemoteMetadata.description,
    inputSchema: z.object({
      action: z.enum(['list', 'add', 'remove', 'get-url']).describe('Remote action to perform'),
      name: z.string().optional().describe('Remote name (default: origin)'),
      url: z.string().optional().describe('Remote URL (required for add)'),
    }),
    execute: async ({ action, name, url }) => {
      try {
        let args: string[];
        switch (action) {
          case 'list':
            args = ['remote', '-v'];
            break;
          case 'add':
            if (!url) return 'Error: URL is required for add action.';
            if (!GIT_URL_PATTERN.test(url)) {
              return 'Error: Invalid git URL format. Must start with https://, git@, ssh://, or git://';
            }
            args = ['remote', 'add', name ?? 'origin', url];
            break;
          case 'remove':
            if (!name) return 'Error: remote name is required for remove action.';
            args = ['remote', 'remove', name];
            break;
          case 'get-url':
            args = ['remote', 'get-url', name ?? 'origin'];
            break;
        }

        const result = await execa('git', args, {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error: ${result.stderr}`;
        }
        return result.stdout || `Remote '${action}' completed successfully.`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
