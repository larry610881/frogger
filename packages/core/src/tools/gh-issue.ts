import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import type { ToolMetadata } from '@frogger/shared';

export const ghIssueMetadata: ToolMetadata = {
  name: 'gh-issue',
  description: 'Read GitHub issue details (title, body, labels, comments)',
  permissionLevel: 'auto',
  category: 'github',
  hints: 'Read GitHub issues for context and requirements.',
};

export function createGhIssueTool(workingDirectory: string) {
  return tool({
    description: ghIssueMetadata.description,
    inputSchema: z.object({
      number: z.number().int().positive().describe('Issue number'),
      repo: z.string().optional().describe('Repository in owner/repo format (defaults to current repo)'),
      includeComments: z.boolean().optional().describe('Include issue comments (default: true)'),
    }),
    execute: async ({ number, repo, includeComments }) => {
      try {
        const args = ['issue', 'view', String(number), '--json', 'number,title,body,state,labels,assignees,milestone,createdAt,author'];
        if (repo) args.push('--repo', repo);

        const result = await execa('gh', args, {
          cwd: workingDirectory,
          reject: false,
          timeout: 15_000,
        });

        if (result.exitCode !== 0) {
          return `Error reading issue #${number}: ${result.stderr}`;
        }

        const issue = JSON.parse(result.stdout);

        // Fetch comments if requested (default true)
        let comments: Array<{ author: { login: string }; body: string; createdAt: string }> = [];
        if (includeComments !== false) {
          const commentsArgs = ['issue', 'view', String(number), '--json', 'comments'];
          if (repo) commentsArgs.push('--repo', repo);

          const commentsResult = await execa('gh', commentsArgs, {
            cwd: workingDirectory,
            reject: false,
            timeout: 15_000,
          });

          if (commentsResult.exitCode === 0) {
            const parsed = JSON.parse(commentsResult.stdout);
            comments = parsed.comments ?? [];
          }
        }

        // Format output
        const labels = issue.labels?.map((l: { name: string }) => l.name).join(', ') || 'none';
        const assignees = issue.assignees?.map((a: { login: string }) => a.login).join(', ') || 'unassigned';

        let output = `# Issue #${issue.number}: ${issue.title}\n\n`;
        output += `**State**: ${issue.state} | **Labels**: ${labels} | **Assignees**: ${assignees}\n`;
        output += `**Author**: ${issue.author?.login ?? 'unknown'} | **Created**: ${issue.createdAt}\n`;
        if (issue.milestone) output += `**Milestone**: ${issue.milestone.title}\n`;
        output += `\n## Body\n\n${issue.body || '(empty)'}\n`;

        if (comments.length > 0) {
          output += `\n## Comments (${comments.length})\n\n`;
          for (const c of comments) {
            output += `### ${c.author?.login ?? 'unknown'} (${c.createdAt})\n${c.body}\n\n`;
          }
        }

        return output;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}
