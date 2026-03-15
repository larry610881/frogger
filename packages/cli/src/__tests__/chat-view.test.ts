import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock DiffView and MarkdownView to avoid their internal dependencies
vi.mock('../components/DiffView.js', () => ({
  DiffView: ({ diff }: { diff: string }) => React.createElement('ink-text', null, `[diff:${diff}]`),
}));

vi.mock('../components/MarkdownView.js', () => ({
  MarkdownView: ({ content }: { content: string }) => React.createElement('ink-text', null, content),
}));

import { ChatView } from '../components/ChatView.js';

describe('ChatView', () => {
  it('renders user message with > prefix', () => {
    const { lastFrame } = render(
      React.createElement(ChatView, {
        message: { role: 'user', content: 'hello world' },
      }),
    );
    const frame = lastFrame()!;
    expect(frame).toContain('>');
    expect(frame).toContain('hello world');
  });

  it('renders assistant message with "Frogger:" text', () => {
    const { lastFrame } = render(
      React.createElement(ChatView, {
        message: { role: 'assistant', content: 'I can help with that' },
      }),
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Frogger:');
    expect(frame).toContain('I can help with that');
  });

  it('renders tool message with ✦ prefix and tool name', () => {
    const { lastFrame } = render(
      React.createElement(ChatView, {
        message: { role: 'tool', content: 'read-file\ncontents of the file here' },
      }),
    );
    const frame = lastFrame()!;
    expect(frame).toContain('✦');
    expect(frame).toContain('read-file');
  });

  it('renders assistant message content via MarkdownView', () => {
    const { lastFrame } = render(
      React.createElement(ChatView, {
        message: { role: 'assistant', content: '## Hello World' },
      }),
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Hello World');
  });
});
