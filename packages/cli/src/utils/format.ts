import type { TokenUsage } from '@frogger/shared';
import { MODEL_PRICING } from '@frogger/shared';
import type { CommandHint } from '../components/InputBox.js';

/** Static command list for autocomplete — matches registered commands */
export const COMMAND_HINTS: CommandHint[] = [
  { name: 'help', description: 'List all available commands' },
  { name: 'clear', description: 'Clear all conversation context' },
  { name: 'compact', description: 'Manually compact conversation context' },
  { name: 'compact-threshold', description: 'Set auto-compact threshold (10-100)' },
  { name: 'cost', description: 'Show session token usage and cost' },
  { name: 'context', description: 'Show context window usage details' },
  { name: 'doctor', description: 'Check environment and configuration' },
  { name: 'model', description: 'Switch provider/model' },
  { name: 'setup', description: 'Configure API key and provider' },
  { name: 'undo', description: 'Revert the last git commit' },
  { name: 'sessions', description: 'List recent sessions' },
  { name: 'resume', description: 'Resume a previous session' },
  { name: 'git-auth', description: 'Check git auth status / configure credentials' },
  { name: 'rewind', description: 'Rewind to a previous checkpoint' },
  { name: 'mcp', description: 'List MCP servers and tools' },
  { name: 'issue', description: 'Start working on a GitHub issue' },
  { name: 'bg', description: 'Start a background task' },
  { name: 'tasks', description: 'List background tasks' },
  { name: 'task', description: 'View or cancel a background task' },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

export interface PendingToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000).toFixed(2)}K`;
}

export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string,
  options?: {
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  },
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;

  const { reasoningTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0 } = options ?? {};

  // Reasoning tokens are billed at output pricing
  const outputTokens = completionTokens + reasoningTokens;

  // Cache tokens: reads at 10% input price, creation at 125% input price
  // Subtract cached tokens from regular prompt tokens to avoid double-counting
  const regularPromptTokens = Math.max(0, promptTokens - cacheReadTokens - cacheCreationTokens);
  const cacheReadCost = cacheReadTokens * pricing.input * 0.1;
  const cacheCreationCost = cacheCreationTokens * pricing.input * 1.25;

  return (regularPromptTokens * pricing.input + outputTokens * pricing.output + cacheReadCost + cacheCreationCost) / 1_000_000;
}

export function formatStats(elapsedMs: number, tokens?: TokenUsage, model?: string): string {
  const secs = elapsedMs / 1000;
  const time = secs >= 60
    ? `${Math.floor(secs / 60)}m${Math.round(secs % 60)}s`
    : `${secs.toFixed(1)}s`;

  const parts = [`Total: ${time}`];
  if (tokens) {
    let tokenDetail = `${formatTokens(tokens.totalTokens)} tokens (in: ${formatTokens(tokens.promptTokens)}, out: ${formatTokens(tokens.completionTokens)}`;
    if (tokens.reasoningTokens) {
      tokenDetail += `, reasoning: ${formatTokens(tokens.reasoningTokens)}`;
    }
    if (tokens.cacheReadTokens) {
      tokenDetail += `, cache hit: ${formatTokens(tokens.cacheReadTokens)}`;
    }
    tokenDetail += ')';
    parts.push(tokenDetail);
    if (model) {
      const cost = calculateCost(tokens.promptTokens, tokens.completionTokens, model, {
        reasoningTokens: tokens.reasoningTokens,
        cacheReadTokens: tokens.cacheReadTokens,
        cacheCreationTokens: tokens.cacheCreationTokens,
      });
      if (cost !== null) {
        parts.push(`Cost: $${cost.toFixed(2)}`);
      }
    }
  }
  return parts.join(' | ');
}

export function formatToolSummary(toolName: string, args: Record<string, unknown>, result: string): string {
  const argHint = getArgHint(toolName, args);
  // Don't truncate results containing diff blocks
  if (result.includes('```diff')) {
    return `${toolName}${argHint}\n${result}`;
  }
  const resultPreview = result.length > 200
    ? result.slice(0, 200) + `... [truncated, full: ${result.length} chars]`
    : result;
  return `${toolName}${argHint}\n${resultPreview}`;
}

function getArgHint(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'read-file':
    case 'write-file':
    case 'edit-file':
      return args.path ? `: ${args.path}` : '';
    case 'glob':
    case 'grep':
      return args.pattern ? `: ${args.pattern}` : '';
    case 'list-files':
      return args.path ? `: ${args.path}` : '';
    case 'bash':
      return args.command ? `: ${String(args.command).slice(0, 60)}` : '';
    default:
      return '';
  }
}
