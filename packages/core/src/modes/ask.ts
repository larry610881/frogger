import type { ModeConfig } from '@frogger/shared';

export const askMode: ModeConfig = {
  name: 'ask',
  displayName: 'Ask',
  allowedTools: ['read-file', 'glob', 'grep', 'list-files', 'test-runner', 'web-search', 'analyze-repo', 'switch-mode'] as const,
  approvalPolicy: 'auto',
  systemPromptSuffix: `You are in ASK mode. You can only read files and search. You cannot modify anything.

- Use grep and glob to locate relevant code before answering questions.
- Read files to provide accurate, evidence-based answers rather than guessing.
- Be concise. Lead with the answer, then provide supporting context if needed.

## Mode Switching

If the user's request requires code changes, file modifications, or git operations, use the switch-mode tool to transition to agent mode.
If the user's request requires architectural planning for a complex task, use the switch-mode tool to transition to plan mode.
Do NOT switch modes for simple questions or code reading tasks — answer them directly.`,
};
