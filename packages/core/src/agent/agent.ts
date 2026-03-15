import { streamText, stepCountIs, type ModelMessage } from 'ai';
import type { JSONValue } from '@ai-sdk/provider';
import type { AgentEvent, TokenUsage, ProviderCapabilities } from '@frogger/shared';
import { MAX_STEPS, COMPACT_PRESERVE_RECENT, DEFAULT_CONTEXT_WINDOW } from '@frogger/shared';
import { logger } from '../utils/logger.js';
import { isRetryableError, calculateDelay, sleep, DEFAULT_RETRY_OPTIONS } from './retry.js';

export interface ThinkingConfig {
  enabled: boolean;
  budgetTokens: number;
}

export interface RunAgentOptions {
  model: Parameters<typeof streamText>[0]['model'];
  systemPrompt: string;
  messages: ModelMessage[];
  tools: Record<string, any>;
  maxSteps?: number;
  abortSignal?: AbortSignal;
  thinking?: ThinkingConfig;
  /** Provider type hint for enabling provider-specific features (e.g. caching) */
  providerType?: string;
  /** Resolved provider capabilities — preferred over providerType for feature detection */
  capabilities?: ProviderCapabilities;
  /** Maximum number of retries for transient API errors (default: 3) */
  maxRetries?: number;
}

function enforceHardLimit(messages: ModelMessage[], maxTokenEstimate: number): ModelMessage[] {
  const estimateTokens = (msgs: ModelMessage[]) =>
    msgs.reduce((sum, m) => sum + JSON.stringify(m).length / 4, 0);

  if (estimateTokens(messages) <= maxTokenEstimate) return messages;

  const preserve = COMPACT_PRESERVE_RECENT; // 4
  if (messages.length <= preserve) return messages;

  // Keep first message (system context) + last N messages
  const first = messages[0];
  const recent = messages.slice(-preserve);
  const trimmed = [first, ...recent];

  logger.warn(`Hard limit: truncated ${messages.length} → ${trimmed.length} messages`);
  return trimmed;
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
    thinking,
    providerType,
    capabilities,
    maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
  } = options;

  logger.debug(`Agent loop starting — maxSteps=${maxSteps}, messages=${messages.length}`);

  // Derive capabilities — prefer explicit, fall back to providerType heuristic
  const supportsThinking = capabilities?.thinking ?? (providerType === 'anthropic');
  const supportsCaching = capabilities?.caching ?? (providerType === 'anthropic');

  // Build provider-specific options (thinking + caching)
  const anthropicOptions: Record<string, JSONValue> = {};

  if (thinking?.enabled && supportsThinking) {
    anthropicOptions.thinking = { type: 'enabled', budgetTokens: thinking.budgetTokens };
  }

  if (supportsCaching) {
    anthropicOptions.cacheControl = { type: 'ephemeral' };
  }

  const providerOptions = Object.keys(anthropicOptions).length > 0
    ? { anthropic: anthropicOptions }
    : undefined;

  const maxAttempts = maxRetries + 1; // total attempts = retries + initial
  const safeMsgs = enforceHardLimit(messages, DEFAULT_CONTEXT_WINDOW * 0.9);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let hasYielded = false;

    try {
      const result = streamText({
        model,
        system: systemPrompt,
        messages: safeMsgs,
        tools,
        stopWhen: stepCountIs(maxSteps),
        abortSignal,
        providerOptions,
      });

      const accumulatedUsage: TokenUsage = {
        promptTokens: 0, completionTokens: 0, totalTokens: 0,
        reasoningTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
      };

      for await (const part of result.fullStream) {
        hasYielded = true;

        switch (part.type) {
          case 'text-delta':
            yield { type: 'text_delta', textDelta: part.text };
            break;

          case 'reasoning-delta':
            yield { type: 'thinking_delta', thinkingDelta: part.text };
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

              // Extract provider-specific metadata (Anthropic reasoning + cache tokens)
              const meta = (part as Record<string, unknown>).providerMetadata as Record<string, Record<string, unknown>> | undefined;
              const anthropicMeta = meta?.anthropic;
              if (anthropicMeta) {
                accumulatedUsage.reasoningTokens! += (anthropicMeta.reasoningTokens as number) ?? 0;
                accumulatedUsage.cacheReadTokens! += (anthropicMeta.cacheReadInputTokens as number) ?? 0;
                accumulatedUsage.cacheCreationTokens! += (anthropicMeta.cacheCreationInputTokens as number) ?? 0;
              }

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
          reasoningTokens: accumulatedUsage.reasoningTokens,
          cacheReadTokens: accumulatedUsage.cacheReadTokens,
          cacheCreationTokens: accumulatedUsage.cacheCreationTokens,
        },
      };
      return; // Success — exit retry loop
    } catch (err) {
      // Already yielded events → UI has partial data, cannot safely retry
      if (hasYielded) throw err;
      // Non-retryable error → propagate immediately
      if (!isRetryableError(err)) throw err;
      // Exhausted all retries → propagate
      if (attempt >= maxAttempts - 1) throw err;

      const delay = calculateDelay(attempt);
      logger.warn(`Retryable error (attempt ${attempt + 1}/${maxAttempts}): ${err instanceof Error ? err.message : err}`);
      yield { type: 'error', error: `Retrying (${attempt + 1}/${maxAttempts})...`, code: 'RETRY' };
      await sleep(delay, abortSignal);
    }
  }
}
