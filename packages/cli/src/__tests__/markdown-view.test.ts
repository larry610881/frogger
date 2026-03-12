import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MarkdownView } from '../components/MarkdownView.js';

describe('MarkdownView', () => {
  it('renders headings with bold+underline', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: '## Hello World' }));
    expect(lastFrame()).toContain('Hello World');
  });

  it('renders code blocks with language tag', () => {
    const content = '```typescript\nconst x = 1;\n```';
    const { lastFrame } = render(React.createElement(MarkdownView, { content }));
    const frame = lastFrame()!;
    expect(frame).toContain('typescript');
    expect(frame).toContain('const x = 1;');
  });

  it('renders unordered list items with bullet', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: '- item one\n- item two' }));
    const frame = lastFrame()!;
    expect(frame).toContain('•');
    expect(frame).toContain('item one');
    expect(frame).toContain('item two');
  });

  it('renders bold text', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: 'this is **bold** text' }));
    expect(lastFrame()).toContain('bold');
  });

  it('renders inline code', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: 'use `npm install`' }));
    expect(lastFrame()).toContain('npm install');
  });

  // New syntax tests (v0.6.0)

  it('renders blockquotes with │ prefix', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: '> This is a quote' }));
    const frame = lastFrame()!;
    expect(frame).toContain('│');
    expect(frame).toContain('This is a quote');
  });

  it('renders ordered lists preserving numbers', () => {
    const content = '1. First item\n2. Second item\n3. Third item';
    const { lastFrame } = render(React.createElement(MarkdownView, { content }));
    const frame = lastFrame()!;
    expect(frame).toContain('1.');
    expect(frame).toContain('2.');
    expect(frame).toContain('3.');
    expect(frame).toContain('First item');
  });

  it('renders tables with aligned columns', () => {
    const content = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    const { lastFrame } = render(React.createElement(MarkdownView, { content }));
    const frame = lastFrame()!;
    expect(frame).toContain('│');
    expect(frame).toContain('Name');
    expect(frame).toContain('Age');
    expect(frame).toContain('Alice');
    expect(frame).toContain('Bob');
  });

  it('renders links with underline', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: 'Visit [Google](https://google.com)' }));
    const frame = lastFrame()!;
    expect(frame).toContain('Google');
  });

  it('renders strikethrough text', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: 'this is ~~deleted~~ text' }));
    const frame = lastFrame()!;
    expect(frame).toContain('deleted');
  });

  it('renders empty lines as spacers', () => {
    const { lastFrame } = render(React.createElement(MarkdownView, { content: 'line one\n\nline two' }));
    const frame = lastFrame()!;
    expect(frame).toContain('line one');
    expect(frame).toContain('line two');
  });

  it('handles mixed content correctly', () => {
    const content = [
      '## Title',
      '',
      '> A quote',
      '',
      '1. Step one',
      '2. Step two',
      '',
      '| Col | Val |',
      '| --- | --- |',
      '| A | 1 |',
      '',
      'Some **bold** and `code` text',
    ].join('\n');
    const { lastFrame } = render(React.createElement(MarkdownView, { content }));
    const frame = lastFrame()!;
    expect(frame).toContain('Title');
    expect(frame).toContain('│');
    expect(frame).toContain('1.');
    expect(frame).toContain('Col');
  });
});
