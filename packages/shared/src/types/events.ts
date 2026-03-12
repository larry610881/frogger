import type { ModeName } from './modes.js';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export type AgentEvent =
  | { type: 'text_delta'; textDelta: string }
  | { type: 'thinking_delta'; thinkingDelta: string }
  | { type: 'tool_call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; toolName: string; result: string }
  | { type: 'mode_change'; from: ModeName; to: ModeName }
  | { type: 'usage_update'; usage: TokenUsage }
  | { type: 'error'; error: string; code?: string }
  | { type: 'done'; usage: TokenUsage };
