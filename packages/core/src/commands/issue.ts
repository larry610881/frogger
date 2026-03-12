import { execa } from 'execa';
import type { SlashCommand } from './types.js';

/** Sanitize issue title into a branch-safe slug */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export const issueCommand: SlashCommand = {
  name: 'issue',
  description: 'Start working on a GitHub issue',
  usage: '/issue <number>',

  async execute(args, context) {
    const raw = args[0]?.replace(/^#/, '');
    const num = Number(raw);
    if (!raw || !Number.isInteger(num) || num <= 0) {
      return { type: 'message', message: 'Usage: /issue <number>  (e.g. /issue 42)' };
    }

    // 1. Verify gh CLI is authenticated
    const authCheck = await execa('gh', ['auth', 'status'], { reject: false, timeout: 10_000 });
    if (authCheck.exitCode !== 0) {
      return {
        type: 'error',
        message: 'GitHub CLI is not authenticated. Run `gh auth login` first.',
      };
    }

    // 2. Fetch issue data
    const issueResult = await execa('gh', [
      'issue', 'view', String(num),
      '--json', 'number,title,body,state,labels,assignees',
    ], { reject: false, timeout: 15_000 });

    if (issueResult.exitCode !== 0) {
      return {
        type: 'error',
        message: `Failed to fetch issue #${num}: ${issueResult.stderr}`,
      };
    }

    const issue = JSON.parse(issueResult.stdout) as {
      number: number;
      title: string;
      body: string;
      state: string;
      labels: Array<{ name: string }>;
      assignees: Array<{ login: string }>;
    };

    if (issue.state === 'CLOSED') {
      return {
        type: 'error',
        message: `Issue #${num} is already closed.`,
      };
    }

    // 3. Derive branch name
    const labelNames = issue.labels.map(l => l.name.toLowerCase());
    const isBug = labelNames.includes('bug');
    const prefix = isBug ? 'fix' : 'feature';
    const slug = slugify(issue.title);
    const branchName = `${prefix}/${num}-${slug}`;

    // 4. Build context labels
    const labels = issue.labels.map(l => l.name).join(', ') || 'none';

    // 5. Inject structured message into conversation (same pattern as /remember)
    const injectedMessage = [
      `You are now working on GitHub Issue #${issue.number}: ${issue.title}`,
      '',
      '## Issue Details',
      `- **Labels**: ${labels}`,
      `- **State**: ${issue.state}`,
      '',
      '## Issue Body',
      issue.body || '(empty)',
      '',
      '## Workflow',
      `1. Create and checkout branch: \`${branchName}\``,
      '2. Analyze the issue requirements',
      '3. Implement the changes',
      '4. Write/update tests',
      `5. Commit with message referencing the issue (e.g. "feat(core): ... Refs #${num}")`,
      `6. Push the branch: \`git push -u origin ${branchName}\``,
      `7. Create a PR using the gh-pr tool with body containing "Closes #${num}"`,
      '',
      'Start by creating the branch and analyzing what needs to be done.',
    ].join('\n');

    context.messagesRef.current.push({
      role: 'user',
      content: injectedMessage,
    } as any);

    const titlePreview = issue.title.length > 60
      ? issue.title.slice(0, 57) + '...'
      : issue.title;

    return {
      type: 'message',
      message: `Starting work on #${num}: ${titlePreview}\nBranch: ${branchName}`,
    };
  },
};
