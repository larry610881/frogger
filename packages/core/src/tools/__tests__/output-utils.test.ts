import { describe, it, expect } from 'vitest';
import { truncateOutput } from '../output-utils.js';

describe('truncateOutput', () => {
  it('returns short text unchanged', () => {
    const text = 'hello world';
    expect(truncateOutput(text)).toBe(text);
  });

  it('truncates text exceeding maxChars with notice', () => {
    const text = 'a'.repeat(40_000);
    const result = truncateOutput(text);
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain('[output truncated: showing first 30,000 of 40,000 characters]');
  });

  it('respects custom maxChars parameter', () => {
    const text = 'a'.repeat(200);
    const result = truncateOutput(text, 100);
    expect(result).toContain('[output truncated: showing first 100 of 200 characters]');
    expect(result.startsWith('a'.repeat(100))).toBe(true);
  });

  it('returns text unchanged when length equals maxChars', () => {
    const text = 'a'.repeat(100);
    expect(truncateOutput(text, 100)).toBe(text);
  });

  it('truncates at line boundary when multiline text exceeds maxChars', () => {
    // Build multiline text where maxChars falls in the middle of a line
    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i}: ${'x'.repeat(10)}`);
    const text = lines.join('\n');
    const maxChars = 50; // Falls in the middle of a line
    const result = truncateOutput(text, maxChars);
    // Should not end with a partial line (before the truncation notice)
    const beforeNotice = result.split('\n\n[output truncated')[0];
    expect(beforeNotice.endsWith('\n') || lines.some(l => beforeNotice.endsWith(l))).toBe(true);
  });

  it('falls back to char truncation for single-line text', () => {
    const text = 'a'.repeat(200); // No newlines at all
    const result = truncateOutput(text, 100);
    expect(result).toContain('[output truncated: showing first 100 of 200 characters]');
    expect(result.startsWith('a'.repeat(100))).toBe(true);
  });
});
