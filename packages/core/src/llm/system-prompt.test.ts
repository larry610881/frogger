import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt.js';
import { askMode } from '../modes/ask.js';
import { agentMode } from '../modes/agent.js';

describe('buildSystemPrompt', () => {
  it('includes app name and working directory', () => {
    const prompt = buildSystemPrompt({
      modeConfig: askMode,
      workingDirectory: '/home/user/project',
    });

    expect(prompt).toContain('frogger');
    expect(prompt).toContain('/home/user/project');
  });

  it('includes mode suffix', () => {
    const prompt = buildSystemPrompt({
      modeConfig: askMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('ASK mode');
    expect(prompt).toContain('cannot modify anything');
  });

  it('includes agent mode suffix', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('AGENT mode');
    expect(prompt).toContain('full access');
  });

  it('includes project context when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: askMode,
      workingDirectory: '/tmp',
      projectContext: 'This is a React project using TypeScript.',
    });

    expect(prompt).toContain('Project Context');
    expect(prompt).toContain('React project using TypeScript');
  });

  it('excludes project context section when not provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: askMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).not.toContain('Project Context');
  });

  it('includes toolHints when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
      toolHints: '## Tool Usage Guide\n\n### Reading\n- **read-file**: Read before editing.',
    });

    expect(prompt).toContain('Tool Usage Guide');
    expect(prompt).toContain('read-file');
  });

  it('excludes toolHints when not provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).not.toContain('Tool Usage Guide');
  });

  it('includes projectInfo when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
      projectInfo: 'Language: TypeScript | Package manager: pnpm | Monorepo: yes',
    });

    expect(prompt).toContain('Project: Language: TypeScript');
    expect(prompt).toContain('pnpm');
  });

  it('excludes projectInfo when not provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).not.toContain('Project:');
  });

  it('includes error recovery section for ask mode', () => {
    const prompt = buildSystemPrompt({
      modeConfig: askMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('Error Recovery');
    expect(prompt).toContain('tool call fails');
  });

  it('does not include the generic error recovery section for agent mode', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    // The generic error recovery section has this specific line; agent mode has its own version in the suffix
    expect(prompt).not.toContain('If a file read fails, check the path exists using glob or list-files.');
  });

  it('includes destructive operations safety section in agent mode', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('Destructive Operations');
    expect(prompt).toContain('git push --force');
    expect(prompt).toContain('rm -rf');
    expect(prompt).toContain('--no-verify');
  });

  it('includes file reference note', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('@path syntax');
    expect(prompt).toContain('file path and line number');
  });

  it('includes repo map when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
      repoMap: 'src/\n  index.ts\n  utils/',
    });

    expect(prompt).toContain('Repository Structure');
    expect(prompt).toContain('index.ts');
  });

  it('includes rules when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
      rules: 'Always use TypeScript strict mode.',
    });

    expect(prompt).toContain('Rules');
    expect(prompt).toContain('TypeScript strict mode');
  });

  it('includes memory when provided', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
      memory: 'User prefers tabs over spaces.',
    });

    expect(prompt).toContain('Memory');
    expect(prompt).toContain('tabs over spaces');
  });

  it('includes SWE-bench strategy sections in agent mode', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });
    expect(prompt).toContain('Repository Exploration');
    expect(prompt).toContain('Bug Localization Strategy');
    expect(prompt).toContain('Multi-File Editing');
  });
});
