import { describe, it, expect } from 'vitest';
import { truncateOutput, matchesToolName } from '../executor.js';
import { MAX_TOOL_RESULT_SIZE } from '@frogger/shared';

describe('truncateOutput', () => {
  it('returns input unchanged when under limit', () => {
    const input = 'short result';
    expect(truncateOutput(input, MAX_TOOL_RESULT_SIZE)).toBe(input);
  });

  it('truncates input that exceeds limit and adds suffix', () => {
    const input = 'x'.repeat(MAX_TOOL_RESULT_SIZE + 500);
    const result = truncateOutput(input, MAX_TOOL_RESULT_SIZE);
    expect(result.length).toBe(MAX_TOOL_RESULT_SIZE + '\n[truncated]'.length);
    expect(result.endsWith('\n[truncated]')).toBe(true);
    expect(result.startsWith('x'.repeat(100))).toBe(true);
  });

  it('returns input unchanged when exactly at limit', () => {
    const input = 'x'.repeat(MAX_TOOL_RESULT_SIZE);
    expect(truncateOutput(input, MAX_TOOL_RESULT_SIZE)).toBe(input);
  });

  it('works with custom limit', () => {
    const input = 'abcdefghij'; // 10 chars
    const result = truncateOutput(input, 5);
    expect(result).toBe('abcde\n[truncated]');
  });
});

describe('matchesToolName', () => {
  it('matches wildcard', () => {
    expect(matchesToolName('*', 'anything')).toBe(true);
  });

  it('matches prefix wildcard', () => {
    expect(matchesToolName('foo-*', 'foo-bar')).toBe(true);
    expect(matchesToolName('foo-*', 'baz-bar')).toBe(false);
  });

  it('matches exact name', () => {
    expect(matchesToolName('bash', 'bash')).toBe(true);
    expect(matchesToolName('bash', 'bash-extra')).toBe(false);
  });
});
