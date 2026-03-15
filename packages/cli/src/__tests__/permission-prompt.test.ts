import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock @frogger/shared to provide PermissionResponse type without importing the real package
vi.mock('@frogger/shared', () => ({}));

import { PermissionPrompt } from '../components/PermissionPrompt.js';

describe('PermissionPrompt', () => {
  const defaultProps = {
    toolName: 'write-file',
    args: { path: '/tmp/test.txt', content: 'hello' },
    onRespond: vi.fn(),
  };

  it('shows tool name in output', () => {
    const { lastFrame } = render(React.createElement(PermissionPrompt, defaultProps));
    expect(lastFrame()).toContain('write-file');
  });

  it('shows args in output', () => {
    const { lastFrame } = render(React.createElement(PermissionPrompt, defaultProps));
    const frame = lastFrame()!;
    expect(frame).toContain('/tmp/test.txt');
    expect(frame).toContain('hello');
  });

  it('shows permission options text', () => {
    const { lastFrame } = render(React.createElement(PermissionPrompt, defaultProps));
    const frame = lastFrame()!;
    expect(frame).toContain('Allow (once)');
    expect(frame).toContain('Deny');
    expect(frame).toContain('Always allow (project)');
    expect(frame).toContain('Always allow (global)');
  });

  it('key press "y" calls onRespond with "allow"', () => {
    const onRespond = vi.fn();
    const { stdin } = render(
      React.createElement(PermissionPrompt, { ...defaultProps, onRespond }),
    );
    stdin.write('y');
    expect(onRespond).toHaveBeenCalledWith('allow');
  });

  it('key press "n" calls onRespond with "deny"', () => {
    const onRespond = vi.fn();
    const { stdin } = render(
      React.createElement(PermissionPrompt, { ...defaultProps, onRespond }),
    );
    stdin.write('n');
    expect(onRespond).toHaveBeenCalledWith('deny');
  });

  it('key press "a" calls onRespond with "always-project"', () => {
    const onRespond = vi.fn();
    const { stdin } = render(
      React.createElement(PermissionPrompt, { ...defaultProps, onRespond }),
    );
    stdin.write('a');
    expect(onRespond).toHaveBeenCalledWith('always-project');
  });

  it('key press "g" calls onRespond with "always-global"', () => {
    const onRespond = vi.fn();
    const { stdin } = render(
      React.createElement(PermissionPrompt, { ...defaultProps, onRespond }),
    );
    stdin.write('g');
    expect(onRespond).toHaveBeenCalledWith('always-global');
  });
});
