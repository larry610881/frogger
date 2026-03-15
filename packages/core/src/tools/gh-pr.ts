import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const ghPrMetadata: ToolMetadata = {
  name: 'gh-pr',
  description: 'Create a GitHub pull request',
  permissionLevel: 'confirm',
  category: 'github',
  hints: 'Create pull requests with summary and test plan.',
};

export function createGhPrTool(workingDirectory: string) {
  return tool({
    description: ghPrMetadata.description,
    inputSchema: z.object({
      title: z.string().min(1).describe('Pull request title'),
      body: z.string().describe('Pull request body (Markdown)'),
      base: z.string().optional().describe('Base branch (defaults to repo default branch)'),
      head: z.string().optional().describe('Head branch (defaults to current branch)'),
      draft: z.boolean().optional().describe('Create as draft PR'),
      labels: z.array(z.string()).optional().describe('Labels to add'),
      repo: z.string().optional().describe('Repository in owner/repo format (defaults to current repo)'),
    }),
    execute: async ({ title, body, base, head, draft, labels, repo }) => {
      try {
        // Use array form exclusively — no shell interpolation
        const args = ['pr', 'create', '--title', title, '--body', body];
        if (base) args.push('--base', base);
        if (head) args.push('--head', head);
        if (draft) args.push('--draft');
        if (labels && labels.length > 0) {
          args.push('--label', labels.join(','));
        }
        if (repo) args.push('--repo', repo);

        const result = await execa('gh', args, {
          cwd: workingDirectory,
          reject: false,
          timeout: 30_000,
        });

        if (result.exitCode !== 0) {
          return `Error creating PR: ${result.stderr}`;
        }

        // gh pr create outputs the PR URL on success
        const prUrl = result.stdout.trim();
        return `Pull request created successfully: ${prUrl}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
