import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitCommitMetadata: ToolMetadata = {
  name: 'git-commit',
  description: 'Stage files and create a git commit',
  permissionLevel: 'confirm',
};

export function createGitCommitTool(workingDirectory: string) {
  return tool({
    description: gitCommitMetadata.description,
    inputSchema: z.object({
      message: z.string().describe('Commit message'),
      files: z.array(z.string()).optional().describe('Files to stage (default: all modified)'),
    }),
    execute: async ({ message, files }) => {
      try {
        // Stage files
        const addArgs = files && files.length > 0
          ? ['add', ...files]
          : ['add', '-A'];

        const addResult = await execa('git', addArgs, {
          cwd: workingDirectory,
          reject: false,
        });
        if (addResult.exitCode !== 0) {
          return `Error staging files: ${addResult.stderr}`;
        }

        // Commit
        const commitResult = await execa('git', ['commit', '-m', message], {
          cwd: workingDirectory,
          reject: false,
        });
        if (commitResult.exitCode !== 0) {
          return `Error committing: ${commitResult.stderr}`;
        }

        return commitResult.stdout || 'Committed successfully.';
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
