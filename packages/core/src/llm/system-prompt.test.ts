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

  it('includes allowed tools list', () => {
    const prompt = buildSystemPrompt({
      modeConfig: agentMode,
      workingDirectory: '/tmp',
    });

    expect(prompt).toContain('write-file');
    expect(prompt).toContain('bash');
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
});
