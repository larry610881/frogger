import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';
import { resolveGitAuthEnv, filterSensitiveOutput } from './git-auth-utils.js';

export const gitPushMetadata: ToolMetadata = {
  name: 'git-push',
  description: 'Push commits to a remote repository',
  permissionLevel: 'confirm',
};

export function createGitPushTool(workingDirectory: string) {
  return tool({
    description: gitPushMetadata.description,
    inputSchema: z.object({
      remote: z.string().optional().describe('Remote name (default: origin)'),
      branch: z.string().optional().describe('Branch to push'),
      setUpstream: z.boolean().optional().describe('Set upstream tracking (-u flag)'),
      force: z.boolean().optional().describe('Force push with lease (uses --force-with-lease, never --force)'),
    }),
    execute: async ({ remote, branch, setUpstream, force }) => {
      try {
        const authEnv = await resolveGitAuthEnv(workingDirectory);

        const args = ['push'];
        if (setUpstream) args.push('-u');
        if (force) args.push('--force-with-lease');
        if (remote) args.push(remote);
        if (branch) args.push(branch);

        const result = await execa('git', args, {
          cwd: workingDirectory,
          env: { ...process.env, ...authEnv },
          reject: false,
        });

        if (result.exitCode !== 0) {
          const errorOutput = filterSensitiveOutput(result.stderr);
          if (errorOutput.includes('Authentication failed') || errorOutput.includes('could not read')) {
            return `Authentication failed. Use /git-auth to configure credentials.\n\n${errorOutput}`;
          }
          return `Error: ${errorOutput}`;
        }

        return filterSensitiveOutput(result.stderr || result.stdout || 'Push completed successfully.');
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
