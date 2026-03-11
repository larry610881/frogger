import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentEvent } from '@frogger/shared';

// Mock @frogger/core before importing the module under test
vi.mock('@frogger/core', () => {
  class MockModeManager {
    getCurrentMode() {
      return {
        name: 'agent',
        displayName: 'Agent',
        allowedTools: ['read-file', 'write-file'],
        approvalPolicy: 'confirm-writes',
        systemPromptSuffix: 'test suffix',
      };
    }
  }
  return {
    loadConfig: vi.fn().mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    }),
    createModel: vi.fn().mockReturnValue({}),
    createAgentTools: vi.fn().mockResolvedValue({ tools: {}, checkpointManager: null }),
    ModeManager: MockModeManager,
    loadProjectContext: vi.fn().mockResolvedValue(undefined),
    buildSystemPrompt: vi.fn().mockReturnValue('system prompt'),
    generateRepoMap: vi.fn().mockResolvedValue(undefined),
    runAgent: vi.fn(),
  };
});

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { runPipeMode } from '../pipe-mode.js';
import { runAgent } from '@frogger/core';
import fs from 'node:fs/promises';

/**
 * Helper: create an async generator from an array of AgentEvents.
 */
async function* fakeAgentStream(events: AgentEvent[]): AsyncGenerator<AgentEvent> {
  for (const event of events) {
    yield event;
  }
}

describe('runPipeMode', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  const baseOptions = {
    prompt: 'hello',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    workingDirectory: '/tmp/test',
  };

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('outputs JSON Lines for text events', async () => {
    const events: AgentEvent[] = [
      { type: 'text_delta', textDelta: 'Hello' },
      { type: 'text_delta', textDelta: ' world' },
      { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    await runPipeMode(baseOptions);

    const lines = stdoutSpy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
    const textLines = lines.filter((l: Record<string, unknown>) => l.type === 'text_delta');
    expect(textLines).toHaveLength(2);
    expect(textLines[0]).toEqual({ type: 'text_delta', text: 'Hello' });
    expect(textLines[1]).toEqual({ type: 'text_delta', text: ' world' });
  });

  it('outputs tool_call and tool_result events', async () => {
    const events: AgentEvent[] = [
      {
        type: 'tool_call',
        toolCallId: 'tc_1',
        toolName: 'read-file',
        args: { path: '/tmp/test/foo.ts' },
      },
      {
        type: 'tool_result',
        toolCallId: 'tc_1',
        toolName: 'read-file',
        result: 'file content here',
      },
      { type: 'done', usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    await runPipeMode(baseOptions);

    const lines = stdoutSpy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
    const toolCall = lines.find((l: Record<string, unknown>) => l.type === 'tool_call');
    expect(toolCall).toEqual({
      type: 'tool_call',
      toolName: 'read-file',
      args: { path: '/tmp/test/foo.ts' },
    });

    const toolResult = lines.find((l: Record<string, unknown>) => l.type === 'tool_result');
    expect(toolResult).toEqual({
      type: 'tool_result',
      toolName: 'read-file',
      result: 'file content here',
    });
  });

  it('writes output file when specified', async () => {
    const events: AgentEvent[] = [
      { type: 'text_delta', textDelta: 'Hello' },
      { type: 'text_delta', textDelta: ' world' },
      { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    await runPipeMode({ ...baseOptions, outputFile: '/tmp/output.txt' });

    expect(fs.writeFile).toHaveBeenCalledWith('/tmp/output.txt', 'Hello world', 'utf-8');
  });

  it('outputs done event with usage', async () => {
    const events: AgentEvent[] = [
      { type: 'done', usage: { promptTokens: 42, completionTokens: 17, totalTokens: 59 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    await runPipeMode(baseOptions);

    const lines = stdoutSpy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
    const doneLine = lines.find((l: Record<string, unknown>) => l.type === 'done');
    expect(doneLine).toEqual({
      type: 'done',
      usage: { promptTokens: 42, completionTokens: 17 },
    });
  });

  it('filters tools when pipeAllow is specified', async () => {
    const events: AgentEvent[] = [
      { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    const { createAgentTools } = await import('@frogger/core');

    await runPipeMode({ ...baseOptions, pipeAllow: ['read-file'] });

    // Verify createAgentTools was called with filtered allowedTools
    expect(createAgentTools).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedTools: ['read-file'],
      }),
    );
  });

  it('skips usage_update events', async () => {
    const events: AgentEvent[] = [
      { type: 'text_delta', textDelta: 'hi' },
      { type: 'usage_update', usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 } },
      { type: 'done', usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 } },
    ];
    vi.mocked(runAgent).mockReturnValue(fakeAgentStream(events));

    await runPipeMode(baseOptions);

    const lines = stdoutSpy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
    const usageLines = lines.filter((l: Record<string, unknown>) => l.type === 'usage_update');
    expect(usageLines).toHaveLength(0);
  });
});
