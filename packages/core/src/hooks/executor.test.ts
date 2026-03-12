import { describe, it, expect } from 'vitest';
import { matchesToolName, runHooks, truncateOutput, type HookContext } from './executor.js';
import type { HookEntry } from './config.js';
import { MAX_TOOL_RESULT_SIZE } from '@frogger/shared';

describe('matchesToolName', () => {
  it('* matches everything', () => {
    expect(matchesToolName('*', 'bash')).toBe(true);
    expect(matchesToolName('*', 'write-file')).toBe(true);
    expect(matchesToolName('*', 'anything')).toBe(true);
  });

  it('exact match', () => {
    expect(matchesToolName('bash', 'bash')).toBe(true);
    expect(matchesToolName('bash', 'write-file')).toBe(false);
  });

  it('prefix match with *', () => {
    expect(matchesToolName('git-*', 'git-commit')).toBe(true);
    expect(matchesToolName('git-*', 'git-push')).toBe(true);
    expect(matchesToolName('git-*', 'bash')).toBe(false);
  });

  it('does not match partial (no wildcard)', () => {
    expect(matchesToolName('git', 'git-commit')).toBe(false);
  });
});

describe('runHooks', () => {
  const baseContext: HookContext = {
    toolName: 'bash',
    toolArgs: { command: 'echo hello' },
    hookType: 'PreToolUse',
    workingDirectory: '/tmp',
  };

  it('returns empty array when no hooks match', async () => {
    const hooks: HookEntry[] = [{ matcher: 'write-file', command: 'echo x', timeout: 10_000 }];
    const results = await runHooks(hooks, baseContext);
    expect(results).toEqual([]);
  });

  it('executes hook successfully (exit 0)', async () => {
    const hooks: HookEntry[] = [{ matcher: 'bash', command: 'echo test', timeout: 10_000 }];
    const results = await runHooks(hooks, baseContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].stdout.trim()).toBe('test');
  });

  it('reports failure on non-zero exit', async () => {
    const hooks: HookEntry[] = [{ matcher: 'bash', command: 'exit 1', timeout: 10_000 }];
    const results = await runHooks(hooks, baseContext);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('PreToolUse stops at first failure (fail-fast)', async () => {
    const hooks: HookEntry[] = [
      { matcher: '*', command: 'exit 1', timeout: 10_000 },
      { matcher: '*', command: 'echo should-not-run', timeout: 10_000 },
    ];
    const results = await runHooks(hooks, { ...baseContext, hookType: 'PreToolUse' });
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('PostToolUse continues after failure', async () => {
    const hooks: HookEntry[] = [
      { matcher: '*', command: 'exit 1', timeout: 10_000 },
      { matcher: '*', command: 'echo ok', timeout: 10_000 },
    ];
    const results = await runHooks(hooks, { ...baseContext, hookType: 'PostToolUse' });
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });
});

describe('truncateOutput', () => {
  it('returns value unchanged when under maxSize', () => {
    const value = 'short string';
    expect(truncateOutput(value, MAX_TOOL_RESULT_SIZE)).toBe(value);
  });

  it('returns value unchanged when exactly at maxSize', () => {
    const value = 'a'.repeat(MAX_TOOL_RESULT_SIZE);
    expect(truncateOutput(value, MAX_TOOL_RESULT_SIZE)).toBe(value);
  });

  it('truncates value exceeding maxSize with [truncated] suffix', () => {
    const value = 'a'.repeat(MAX_TOOL_RESULT_SIZE + 500);
    const result = truncateOutput(value, MAX_TOOL_RESULT_SIZE);
    expect(result.length).toBe(MAX_TOOL_RESULT_SIZE + '\n[truncated]'.length);
    expect(result.endsWith('\n[truncated]')).toBe(true);
    expect(result.startsWith('a'.repeat(MAX_TOOL_RESULT_SIZE))).toBe(true);
  });
});

describe('runHooks truncation of FROGGER_TOOL_RESULT', () => {
  it('truncates large toolResult in PostToolUse env', async () => {
    const largeResult = 'x'.repeat(MAX_TOOL_RESULT_SIZE + 1000);
    const hooks: HookEntry[] = [
      { matcher: '*', command: 'echo $FROGGER_TOOL_RESULT | wc -c', timeout: 10_000 },
    ];
    const context: HookContext = {
      toolName: 'bash',
      toolArgs: {},
      toolResult: largeResult,
      hookType: 'PostToolUse',
      workingDirectory: '/tmp',
    };
    const results = await runHooks(hooks, context);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    // The byte count from wc -c should be MAX_TOOL_RESULT_SIZE + length of '\n[truncated]' + 1 (newline from echo)
    const expectedLength = MAX_TOOL_RESULT_SIZE + '\n[truncated]'.length + 1;
    expect(parseInt(results[0].stdout.trim())).toBe(expectedLength);
  });
});
