import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../components/InputBox.js';

describe('InputBox', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    disabled: false,
    cycleMode: vi.fn(),
    commands: [] as { name: string; description: string }[],
    inputHistory: [] as string[],
  };

  it('renders prompt character ">"', () => {
    const { lastFrame } = render(React.createElement(InputBox, defaultProps));
    expect(lastFrame()).toContain('>');
  });

  it('shows disabled indicator when disabled', () => {
    const { lastFrame } = render(
      React.createElement(InputBox, { ...defaultProps, disabled: true }),
    );
    // When disabled, the component renders "..." instead of input
    expect(lastFrame()).toContain('...');
  });

  it('calls onSubmit with input text on Enter', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      React.createElement(InputBox, { ...defaultProps, onSubmit }),
    );
    stdin.write('hello world');
    stdin.write('\r');
    expect(onSubmit).toHaveBeenCalledWith('hello world');
  });

  it('does not trigger onSubmit on Enter with empty input', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      React.createElement(InputBox, { ...defaultProps, onSubmit }),
    );
    stdin.write('\r');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows command completions when "/" is typed with commands provided', async () => {
    const commands = [
      { name: 'help', description: 'Show help' },
      { name: 'clear', description: 'Clear history' },
    ];
    const { stdin, lastFrame } = render(
      React.createElement(InputBox, { ...defaultProps, commands }),
    );
    stdin.write('/');
    // Poll for React re-render instead of fixed timeout
    const deadline = Date.now() + 2000;
    let frame = '';
    while (Date.now() < deadline) {
      frame = lastFrame() ?? '';
      if (frame.includes('/help')) break;
      await new Promise(r => setTimeout(r, 20));
    }
    expect(frame).toContain('/help');
    expect(frame).toContain('/clear');
  });
});
