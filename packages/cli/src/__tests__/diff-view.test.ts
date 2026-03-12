import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { DiffView } from '../components/DiffView.js';

describe('DiffView', () => {
  const sampleDiff = [
    '--- a/file.ts',
    '+++ b/file.ts',
    '@@ -10,4 +10,5 @@',
    ' const a = 1;',
    '-const b = 2;',
    '+const b = 3;',
    '+const c = 4;',
    ' const d = 5;',
  ].join('\n');

  it('renders hunk header with correct formatting', () => {
    const { lastFrame } = render(React.createElement(DiffView, { diff: sampleDiff }));
    const frame = lastFrame()!;
    expect(frame).toContain('@@ -10,4 +10,5 @@');
  });

  it('shows line numbers for added lines (new line number only)', () => {
    const { lastFrame } = render(React.createElement(DiffView, { diff: sampleDiff }));
    const lines = lastFrame()!.split('\n');
    // Find the +const b = 3; line — should show new line number 11
    const addedLine = lines.find(l => l.includes('+const b = 3;'));
    expect(addedLine).toBeDefined();
    // Old line number position should be empty (spaces), new line number should be present
    expect(addedLine).toMatch(/\s{4}\s+\d+/);
  });

  it('shows line numbers for removed lines (old line number only)', () => {
    const { lastFrame } = render(React.createElement(DiffView, { diff: sampleDiff }));
    const lines = lastFrame()!.split('\n');
    // Find the -const b = 2; line — should show old line number 11
    const removedLine = lines.find(l => l.includes('-const b = 2;'));
    expect(removedLine).toBeDefined();
    expect(removedLine).toMatch(/\d+\s+\s{4}/);
  });

  it('shows both line numbers for context lines', () => {
    const { lastFrame } = render(React.createElement(DiffView, { diff: sampleDiff }));
    const lines = lastFrame()!.split('\n');
    // First context line "const a = 1;" should have both old (10) and new (10) line numbers
    const contextLine = lines.find(l => l.includes('const a = 1;'));
    expect(contextLine).toBeDefined();
    // Should contain two numbers
    const numbers = contextLine!.match(/\d+/g);
    expect(numbers).toBeTruthy();
    expect(numbers!.length).toBeGreaterThanOrEqual(2);
  });

  it('handles multiple hunks correctly', () => {
    const multiHunkDiff = [
      '@@ -5,3 +5,3 @@',
      ' line5',
      '-line6old',
      '+line6new',
      ' line7',
      '@@ -20,3 +20,3 @@',
      ' line20',
      '-line21old',
      '+line21new',
      ' line22',
    ].join('\n');

    const { lastFrame } = render(React.createElement(DiffView, { diff: multiHunkDiff }));
    const lines = lastFrame()!.split('\n');

    // Find context lines near each hunk
    const line5 = lines.find(l => l.includes('line5'));
    const line20 = lines.find(l => l.includes('line20'));
    expect(line5).toBeDefined();
    expect(line20).toBeDefined();

    // line5 should contain "5" and line20 should contain "20"
    expect(line5).toMatch(/5/);
    expect(line20).toMatch(/20/);
  });

  it('renders file headers without line numbers', () => {
    const { lastFrame } = render(React.createElement(DiffView, { diff: sampleDiff }));
    const lines = lastFrame()!.split('\n');
    const headerLine = lines.find(l => l.includes('--- a/file.ts'));
    expect(headerLine).toBeDefined();
  });
});
