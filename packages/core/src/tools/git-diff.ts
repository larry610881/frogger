import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const gitDiffMetadata: ToolMetadata = {
  name: 'git-diff',
  description: 'Show git diff (unstaged changes, or staged with --staged)',
  permissionLevel: 'auto',
  category: 'git',
  hints: 'Review changes before committing.',
};

export function createGitDiffTool(workingDirectory: string) {
  return tool({
    description: gitDiffMetadata.description,
    inputSchema: z.object({
      staged: z.boolean().optional().describe('Show staged changes instead of unstaged'),
      file: z.string().optional().describe('Specific file to diff'),
    }),
    execute: async ({ staged, file }) => {
      try {
        const args = ['diff'];
        if (staged) args.push('--staged');
        if (file) args.push('--', file);

        const result = await execa('git', args, {
          cwd: workingDirectory,
          reject: false,
        });
        if (result.exitCode !== 0) {
          return `Error: ${result.stderr || 'Git diff failed'}`;
        }
        return result.stdout || '(no changes)';
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
