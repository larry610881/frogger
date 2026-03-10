import type { SlashCommand } from './types.js';

export const costCommand: SlashCommand = {
  name: 'cost',
  description: 'Show session token usage and estimated cost',
  usage: '/cost',

  execute(_args, context) {
    const usage = context.sessionUsage;
    if (!usage) {
      return { type: 'message', message: 'No usage data available yet.' };
    }

    const fmt = (n: number): string => n.toLocaleString();

    const lines = [
      'Session Usage:',
      '',
      `  Prompt tokens:     ${fmt(usage.promptTokens)}`,
      `  Completion tokens: ${fmt(usage.completionTokens)}`,
      `  Total tokens:      ${fmt(usage.totalTokens)}`,
    ];

    if (usage.estimatedCost !== null) {
      lines.push(`  Estimated cost:    $${usage.estimatedCost.toFixed(4)}`);
    } else {
      lines.push('  Estimated cost:    N/A (no pricing data for current model)');
    }

    return { type: 'message', message: lines.join('\n') };
  },
};
