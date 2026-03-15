import type { ModeConfig } from '@frogger/shared';
import { APP_NAME } from '@frogger/shared';

export interface SystemPromptOptions {
  modeConfig: ModeConfig;
  workingDirectory: string;
  projectContext?: string;
  repoMap?: string;
  rules?: string;
  memory?: string;
  toolHints?: string;
  projectInfo?: string;
}

function buildIdentitySection(workingDir: string, projectInfo?: string): string {
  let section = `You are ${APP_NAME}, an AI coding assistant. You help developers understand, modify, and create code.\n\nWorking directory: ${workingDir}`;
  if (projectInfo) section += `\nProject: ${projectInfo}`;
  return section;
}

function buildFileReferenceNote(): string {
  return 'Users may reference files with @path syntax. The file contents will be provided inline.\nWhen referencing code, include the file path and line number (e.g., src/index.ts:42) so the user can navigate to it.';
}

function buildModeSection(modeConfig: ModeConfig): string | undefined {
  return modeConfig.systemPromptSuffix || undefined;
}

function buildToolHintsSection(toolHints?: string): string | undefined {
  return toolHints || undefined;
}

function buildErrorRecoverySection(modeConfig: ModeConfig): string | undefined {
  // Only for ask/plan modes — agent mode handles errors via tool retry
  if (modeConfig.name === 'agent') return undefined;
  return `## Error Recovery
- If a tool call fails, read the error message carefully and adjust your approach.
- If a file read fails, check the path exists using glob or list-files.
- If an edit fails, re-read the file to get the current content.
- If you're stuck, explain the issue to the user and ask for guidance.`;
}

function buildRepoMapSection(repoMap?: string): string | undefined {
  if (!repoMap) return undefined;
  return `## Repository Structure\n\n\`\`\`\n${repoMap}\n\`\`\``;
}

function buildRulesSection(rules?: string): string | undefined {
  if (!rules) return undefined;
  return `## Rules\n\n${rules}`;
}

function buildMemorySection(memory?: string): string | undefined {
  if (!memory) return undefined;
  return `## Memory\n\n${memory}`;
}

function buildProjectContextSection(projectContext?: string): string | undefined {
  if (!projectContext) return undefined;
  return `## Project Context\n\n${projectContext}`;
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const sections = [
    buildIdentitySection(options.workingDirectory, options.projectInfo),
    buildFileReferenceNote(),
    buildModeSection(options.modeConfig),
    buildToolHintsSection(options.toolHints),
    buildErrorRecoverySection(options.modeConfig),
    buildRepoMapSection(options.repoMap),
    buildRulesSection(options.rules),
    buildMemorySection(options.memory),
    buildProjectContextSection(options.projectContext),
  ].filter(Boolean);

  return sections.join('\n\n');
}
