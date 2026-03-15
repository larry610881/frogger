import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import { basename } from 'node:path';
import type { ToolMetadata } from '@frogger/shared';
import { resolveGitAuthEnvForUrl, filterSensitiveOutput } from './git-auth-utils.js';

const GIT_URL_PATTERN = /^(https?:\/\/|git@|ssh:\/\/|git:\/\/)/;

export const gitCloneMetadata: ToolMetadata = {
  name: 'git-clone',
  description: 'Clone a git repository',
  permissionLevel: 'confirm',
  category: 'git',
  hints: 'Clone remote repositories.',
};

export function createGitCloneTool(workingDirectory: string) {
  return tool({
    description: gitCloneMetadata.description,
    inputSchema: z.object({
      url: z.string().describe('Repository URL to clone'),
      directory: z.string().optional().describe('Target directory name'),
      depth: z.number().optional().describe('Shallow clone depth (e.g., 1 for latest commit only)'),
    }),
    execute: async ({ url, directory, depth }) => {
      try {
        if (!GIT_URL_PATTERN.test(url)) {
          return 'Error: Invalid git URL format. Must start with https://, git@, ssh://, or git://';
        }

        const authEnv = await resolveGitAuthEnvForUrl(url);

        const args = ['clone'];
        if (depth) args.push('--depth', String(depth));
        args.push(url);
        if (directory) args.push(directory);

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

        const clonedDir = directory ?? basename(url, '.git');
        const output = filterSensitiveOutput(result.stderr || result.stdout || '');
        return `Cloned successfully to '${clonedDir}'.\n${output}`.trim();
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
