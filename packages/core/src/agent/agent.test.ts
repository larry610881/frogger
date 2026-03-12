import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, reasoningTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
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
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, reasoningTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    });
  });

  it('passes thinking providerOptions when enabled for Anthropic', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([]) as any,
    );

    const events: AgentEvent[] = [];
    for await (const event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
      thinking: { enabled: true, budgetTokens: 10000 },
      providerType: 'anthropic',
    })) {
      events.push(event);
    }

    const callArgs = vi.mocked(streamText).mock.calls[0]![0];
    expect(callArgs.providerOptions).toEqual({
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 10000 },
        cacheControl: { type: 'ephemeral' },
      },
    });
  });

  it('does not pass thinking for non-Anthropic providers', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([]) as any,
    );

    for await (const _event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
      thinking: { enabled: true, budgetTokens: 10000 },
      providerType: 'openai',
    })) {
      // drain
    }

    const callArgs = vi.mocked(streamText).mock.calls[0]![0];
    expect(callArgs.providerOptions).toBeUndefined();
  });

  it('adds cacheControl for Anthropic provider without thinking', async () => {
    vi.mocked(streamText).mockReturnValue(
      createMockStream([]) as any,
    );

    for await (const _event of runAgent({
      model: {} as any,
      systemPrompt: 'test',
      messages: [],
      tools: {},
      providerType: 'anthropic',
    })) {
      // drain
    }

    const callArgs = vi.mocked(streamText).mock.calls[0]![0];
    expect(callArgs.providerOptions).toEqual({
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    });
  });

  describe('providerMetadata extraction', () => {
    it('extracts Anthropic reasoning + cache tokens from finish-step', async () => {
      vi.mocked(streamText).mockReturnValue(
        createMockStream([
          {
            type: 'finish-step',
            usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
            providerMetadata: {
              anthropic: {
                reasoningTokens: 50,
                cacheReadInputTokens: 30,
                cacheCreationInputTokens: 20,
              },
            },
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

      const usageEvent = events.find(e => e.type === 'usage_update');
      expect(usageEvent).toBeDefined();
      expect(usageEvent).toMatchObject({
        type: 'usage_update',
        usage: {
          promptTokens: 200,
          completionTokens: 80,
          reasoningTokens: 50,
          cacheReadTokens: 30,
          cacheCreationTokens: 20,
        },
      });
    });

    it('handles missing providerMetadata gracefully (non-Anthropic)', async () => {
      vi.mocked(streamText).mockReturnValue(
        createMockStream([
          {
            type: 'finish-step',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            // No providerMetadata at all
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

      const usageEvent = events.find(e => e.type === 'usage_update');
      expect(usageEvent).toMatchObject({
        type: 'usage_update',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
    });

    it('handles providerMetadata with undefined token fields', async () => {
      vi.mocked(streamText).mockReturnValue(
        createMockStream([
          {
            type: 'finish-step',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            providerMetadata: {
              anthropic: {
                // reasoningTokens is missing/undefined
                cacheReadInputTokens: undefined,
                cacheCreationInputTokens: 10,
              },
            },
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

      const usageEvent = events.find(e => e.type === 'usage_update');
      expect(usageEvent).toMatchObject({
        type: 'usage_update',
        usage: {
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 10,
        },
      });
    });

    it('accumulates tokens across multiple finish-step events', async () => {
      vi.mocked(streamText).mockReturnValue(
        createMockStream([
          {
            type: 'finish-step',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            providerMetadata: {
              anthropic: { reasoningTokens: 20, cacheReadInputTokens: 10, cacheCreationInputTokens: 5 },
            },
          },
          {
            type: 'finish-step',
            usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
            providerMetadata: {
              anthropic: { reasoningTokens: 30, cacheReadInputTokens: 15, cacheCreationInputTokens: 0 },
            },
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

      const usageEvents = events.filter(e => e.type === 'usage_update');
      expect(usageEvents).toHaveLength(2);
      // Second usage_update should have accumulated values
      expect(usageEvents[1]).toMatchObject({
        type: 'usage_update',
        usage: {
          promptTokens: 300,
          completionTokens: 130,
          reasoningTokens: 50,
          cacheReadTokens: 25,
          cacheCreationTokens: 5,
        },
      });
    });

    it('handles empty anthropic metadata object', async () => {
      vi.mocked(streamText).mockReturnValue(
        createMockStream([
          {
            type: 'finish-step',
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            providerMetadata: {
              anthropic: {},
            },
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

      const usageEvent = events.find(e => e.type === 'usage_update');
      expect(usageEvent).toMatchObject({
        type: 'usage_update',
        usage: {
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
        },
      });
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
