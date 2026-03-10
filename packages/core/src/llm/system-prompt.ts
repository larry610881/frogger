import type { ModeConfig } from '@frogger/shared';
import { APP_NAME } from '@frogger/shared';

export function buildSystemPrompt(options: {
  modeConfig: ModeConfig;
  workingDirectory: string;
  projectContext?: string;
  repoMap?: string;
}): string {
  const { modeConfig, workingDirectory, projectContext, repoMap } = options;

  const parts: string[] = [
    `You are ${APP_NAME}, an AI coding assistant. You help developers understand, modify, and create code.`,
    '',
    `Working directory: ${workingDirectory}`,
    '',
    `Available tools: ${modeConfig.allowedTools.join(', ')}`,
    '',
    'Users may reference files with @path syntax. The file contents will be provided inline.',
    '',
    modeConfig.systemPromptSuffix,
  ];

  if (repoMap) {
    parts.push('', '## Repository Structure', '', '```', repoMap, '```');
  }

  if (projectContext) {
    parts.push('', '## Project Context', '', projectContext);
  }

  return parts.join('\n');
}
