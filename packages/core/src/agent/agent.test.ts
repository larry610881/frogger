import { describe, it, expect, vi } from 'vitest';
import type { AgentEvent } from '@frogger/shared';

// Mock the ai module before importing agent
vi.mock('ai', () => {
  return {
    streamText: vi.fn(),
    stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', count: n })),
  };
});

import { streamText } from 'ai';
import { runAgent } from './agent.js';

function createMockStream(parts: any[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) {
        yield part;
      }
    })(),
    totalUsage: Promise.resolve({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
    }),
  };
}

describe('runAgent', () => {
  it('yields text_delta events', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        { type: 'text-delta', id: '1', text: 'Hello ' },
        { type: 'text-delta', id: '2', text: 'world' },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text_delta', textDelta: 'Hello ' },
      { type: 'text_delta', textDelta: 'world' },
      {
        type: 'done',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
    ]);
  });

  it('yields tool_call events', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        {
          type: 'tool-call',
          toolCallId: 'tc1',
          toolName: 'read_file',
          input: { path: '/tmp/test.ts' },
        },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'tool_call',
      toolCallId: 'tc1',
      toolName: 'read_file',
      args: { path: '/tmp/test.ts' },
    });
  });

  it('yields tool_result events', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        {
          type: 'tool-result',
          toolCallId: 'tc1',
          toolName: 'read_file',
          output: 'file contents here',
        },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'tool_result',
      toolCallId: 'tc1',
      toolName: 'read_file',
      result: 'file contents here',
    });
  });

  it('serializes non-string tool results to JSON', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        {
          type: 'tool-result',
          toolCallId: 'tc1',
          toolName: 'glob',
          output: ['a.ts', 'b.ts'],
        },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'tool_result',
      toolCallId: 'tc1',
      toolName: 'glob',
      result: '["a.ts","b.ts"]',
    });
  });

  it('yields error events', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        { type: 'error', error: new Error('LLM failure') },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: 'error',
      error: 'Error: LLM failure',
    });
  });

  it('yields done event with usage at the end', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'done',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
  });

  it('ignores unhandled stream part types', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([
        { type: 'start' },
        { type: 'text-delta', id: '1', text: 'hi' },
        { type: 'finish', finishReason: 'stop', totalUsage: {} },
      ]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
    })) {
      events.push(event);
    }

    // Should only have text_delta + done, not start/finish
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('text_delta');
    expect(events[1].type).toBe('done');
  });
});
