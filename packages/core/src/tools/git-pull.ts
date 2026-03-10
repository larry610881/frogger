import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';
import { resolveGitAuthEnv, filterSensitiveOutput } from './git-auth-utils.js';

export const gitPullMetadata: ToolMetadata = {
  name: 'git-pull',
  description: 'Pull changes from a remote repository',
  permissionLevel: 'confirm',
};

export function createGitPullTool(workingDirectory: string) {
  return tool({
    description: gitPullMetadata.description,
    inputSchema: z.object({
      remote: z.string().optional().describe('Remote name (default: origin)'),
      branch: z.string().optional().describe('Branch to pull'),
      rebase: z.boolean().optional().describe('Use rebase instead of merge'),
    }),
    execute: async ({ remote, branch, rebase }) => {
      try {
        const authEnv = await resolveGitAuthEnv(workingDirectory);

        const args = ['pull'];
        if (rebase) args.push('--rebase');
        if (remote) args.push(remote);
        if (branch) args.push(branch);

        const result = await execa('git', args, {
          cwd: workingDirectory,
          env: { ...process.env, ...authEnv },
          reject: false,
        });

        if (result.exitCode !== 0) {
          const errorOutput = filterSensitiveOutput(result.stderr);

          if (errorOutput.includes('CONFLICT') || errorOutput.includes('Merge conflict')) {
            return `Merge conflict detected. Please resolve conflicts manually.\n\n${errorOutput}`;
          }

          if (errorOutput.includes('Authentication failed') || errorOutput.includes('could not read')) {
            return `Authentication failed. Use /git-auth to configure credentials.\n\n${errorOutput}`;
          }

          return `Error: ${errorOutput}`;
        }

        return filterSensitiveOutput(result.stdout || result.stderr || 'Pull completed successfully.');
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
