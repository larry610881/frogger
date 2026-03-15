import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

// Mock all external dependencies to isolate App component

vi.mock('@frogger/shared', () => ({
  APP_VERSION: '0.8.0-test',
}));

vi.mock('@frogger/core', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock the hooks
const mockSubmit = vi.fn();
const mockRespondPermission = vi.fn();
const mockCycleMode = vi.fn();

let mockAgentReturn = {
  isStreaming: false,
  streamingText: '',
  thinkingText: '',
  liveUsage: null,
  pendingToolCall: null,
  pendingPermission: null,
  contextBudget: null,
  commandHints: [],
  submit: mockSubmit,
  respondPermission: mockRespondPermission,
};

vi.mock('../hooks/useAgent.js', () => ({
  useAgent: vi.fn(() => mockAgentReturn),
}));

vi.mock('../hooks/useMode.js', () => ({
  useMode: vi.fn(() => ({
    mode: 'agent' as const,
    setMode: vi.fn(),
    cycleMode: mockCycleMode,
  })),
}));

// Mock sub-components that have complex dependencies
vi.mock('../components/WelcomeBanner.js', () => ({
  WelcomeBanner: ({ version }: { version: string }) =>
    React.createElement('ink-text', null, `Welcome Frogger v${version}`),
}));

vi.mock('../components/StreamingStats.js', () => ({
  StreamingStats: () => React.createElement('ink-text', null, '[stats]'),
}));

vi.mock('../components/InitSetup.js', () => ({
  InitSetup: () => React.createElement('ink-text', null, '[setup]'),
}));

vi.mock('../components/Spinner.js', () => ({
  Spinner: ({ label }: { label: string }) =>
    React.createElement('ink-text', null, `[spinner: ${label}]`),
}));

vi.mock('../components/ThinkingView.js', () => ({
  ThinkingView: ({ text }: { text: string }) =>
    React.createElement('ink-text', null, `[thinking: ${text}]`),
}));

vi.mock('../components/PermissionPrompt.js', () => ({
  PermissionPrompt: ({ toolName }: { toolName: string }) =>
    React.createElement('ink-text', null, `[permission: ${toolName}]`),
}));

vi.mock('../components/ChatView.js', () => ({
  ChatView: () => React.createElement('ink-text', null, '[chat]'),
}));

import { App } from '../components/App.js';

describe('App', () => {
  it('shows welcome text in initial state', () => {
    const { lastFrame } = render(React.createElement(App, {}));
    const frame = lastFrame()!;
    expect(frame).toContain('Welcome');
    expect(frame).toContain('0.8.0-test');
  });

  it('shows mode indicator', () => {
    const { lastFrame } = render(React.createElement(App, {}));
    const frame = lastFrame()!;
    // ModeIndicator renders [AGENT] for the 'agent' mode
    expect(frame).toContain('AGENT');
  });

  it('shows spinner when streaming with no text and no tool call and no permission', () => {
    mockAgentReturn = {
      ...mockAgentReturn,
      isStreaming: true,
      streamingText: '',
      thinkingText: '',
      pendingToolCall: null,
      pendingPermission: null,
    };

    const { lastFrame } = render(React.createElement(App, {}));
    const frame = lastFrame()!;
    expect(frame).toContain('spinner');
    expect(frame).toContain('Thinking...');
  });

  it('shows thinking view when thinkingText is set', () => {
    mockAgentReturn = {
      ...mockAgentReturn,
      isStreaming: true,
      streamingText: '',
      thinkingText: 'analyzing the problem',
      pendingToolCall: null,
      pendingPermission: null,
    };

    const { lastFrame } = render(React.createElement(App, {}));
    const frame = lastFrame()!;
    expect(frame).toContain('thinking');
    expect(frame).toContain('analyzing the problem');
  });

  it('shows permission prompt when pendingPermission exists', () => {
    mockAgentReturn = {
      ...mockAgentReturn,
      isStreaming: true,
      streamingText: '',
      thinkingText: '',
      pendingToolCall: null,
      pendingPermission: {
        toolName: 'bash',
        args: { command: 'ls' },
        resolve: vi.fn(),
      },
    };

    const { lastFrame } = render(React.createElement(App, {}));
    const frame = lastFrame()!;
    expect(frame).toContain('permission');
    expect(frame).toContain('bash');
  });
});
