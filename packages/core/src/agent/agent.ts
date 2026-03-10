import { streamText, stepCountIs, type ModelMessage } from 'ai';
import type { AgentEvent, TokenUsage } from '@frogger/shared';
import { MAX_STEPS } from '@frogger/shared';
import { logger } from '../utils/logger.js';

export interface RunAgentOptions {
  model: Parameters<typeof streamText>[0]['model'];
  systemPrompt: string;
  messages: ModelMessage[];
  tools: Record<string, any>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
}

export async function* runAgent(
  options: RunAgentOptions,
): AsyncGenerator<AgentEvent> {
  const {
    model,
    systemPrompt,
    messages,
    tools,
    maxSteps = MAX_STEPS,
    abortSignal,
  } = options;

  logger.debug(`Agent loop starting — maxSteps=${maxSteps}, messages=${messages.length}`);

  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
    abortSignal,
  });

  const accumulatedUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'text-delta':
        yield { type: 'text_delta', textDelta: part.text };
        break;

      case 'tool-call':
        yield {
          type: 'tool_call',
          toolCallId: part.toolCallId,
          toolName: part.toolName as string,
          args: part.input as Record<string, unknown>,
        };
        break;

      case 'tool-result':
        yield {
          type: 'tool_result',
          toolCallId: part.toolCallId,
          toolName: part.toolName as string,
          result:
            typeof part.output === 'string'
              ? part.output
              : JSON.stringify(part.output),
        };
        break;

      case 'finish-step': {
        const stepUsage = part.usage;
        if (stepUsage) {
          accumulatedUsage.promptTokens += stepUsage.inputTokens ?? 0;
          accumulatedUsage.completionTokens += stepUsage.outputTokens ?? 0;
          accumulatedUsage.totalTokens += stepUsage.totalTokens ?? 0;
          yield {
            type: 'usage_update',
            usage: { ...accumulatedUsage },
          };
        }
        break;
      }

      case 'error':
        yield { type: 'error', error: String(part.error) };
        break;
    }
  }

  const usage = await result.totalUsage;
  logger.debug(`Agent loop done — tokens: in=${usage.inputTokens ?? 0}, out=${usage.outputTokens ?? 0}`);
  yield {
    type: 'done',
    usage: {
      promptTokens: usage.inputTokens ?? 0,
      completionTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
    },
  };
}
