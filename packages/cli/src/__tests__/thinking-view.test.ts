import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ThinkingView } from '../components/ThinkingView.js';

describe('ThinkingView', () => {
  it('renders "Thinking..." label', () => {
    const { lastFrame } = render(React.createElement(ThinkingView, { text: 'hello' }));
    expect(lastFrame()).toContain('Thinking...');
  });

  it('shows provided text content', () => {
    const { lastFrame } = render(React.createElement(ThinkingView, { text: 'analyzing code' }));
    expect(lastFrame()).toContain('analyzing code');
  });

  it('only shows last 5 lines when text has more than 5 lines', () => {
    const lines = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6', 'line7'];
    const { lastFrame } = render(React.createElement(ThinkingView, { text: lines.join('\n') }));
    const frame = lastFrame()!;
    // First two lines should be truncated
    expect(frame).not.toContain('line1');
    expect(frame).not.toContain('line2');
    // Last 5 lines should be visible
    expect(frame).toContain('line3');
    expect(frame).toContain('line4');
    expect(frame).toContain('line5');
    expect(frame).toContain('line6');
    expect(frame).toContain('line7');
  });

  it('still shows "Thinking..." label when text is empty', () => {
    const { lastFrame } = render(React.createElement(ThinkingView, { text: '' }));
    expect(lastFrame()).toContain('Thinking...');
  });
});
