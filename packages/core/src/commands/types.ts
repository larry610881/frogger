import type { ModelMessage, LanguageModel } from 'ai';
import type { ModelInfo, ProviderEntry } from '@frogger/shared';
import type { ContextBudgetTracker } from '../agent/context-budget.js';
import type { MCPClientManager } from '../mcp/client.js';
import type { BackgroundTaskManager, BackgroundTaskRunner } from '../agent/background-task.js';

export interface BaseCommandContext {
  messagesRef: { current: ModelMessage[] };
  onClearHistory?: () => void;
  mcpClientManager?: MCPClientManager;
  backgroundTaskManager?: BackgroundTaskManager;
  createBackgroundAgent?: (prompt: string) => BackgroundTaskRunner;
  onBackgroundTaskComplete?: (taskId: string) => void;
}

export interface BudgetContext {
  budgetTracker: ContextBudgetTracker | null;
  model: LanguageModel | null;
  onCompactDone?: (summary: string, compactedCount: number) => void;
}

export interface ProviderContext {
  providers: ProviderEntry[];
  currentProvider: string;
  currentModel: string;
  onProviderModelChange?: (provider: string, model: string) => void;
  onTriggerSetup?: () => void;
}

export interface UsageContext {
  sessionUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number | null;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
}

// Backward-compatible: full context = intersection of all sub-interfaces
export type SlashCommandContext = BaseCommandContext & BudgetContext & ProviderContext & UsageContext;

export type SlashCommandResultType = 'message' | 'error' | 'interactive';

export interface SlashCommandResult {
  type: SlashCommandResultType;
  message: string;
  /** For /model: list of choices to display */
  choices?: Array<{ provider: string; model: string; label: string }>;
  /** For /rewind: message index to truncate conversation at */
  messageIndex?: number;
}

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  execute: (args: string[], context: SlashCommandContext) => Promise<SlashCommandResult> | SlashCommandResult;
}
