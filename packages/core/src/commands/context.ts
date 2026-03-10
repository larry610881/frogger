import type { SlashCommand } from './types.js';

export const contextCommand: SlashCommand = {
  name: 'context',
  description: 'Show detailed context window usage',
  usage: '/context',

  execute(_args, context) {
    const tracker = context.budgetTracker;
    if (!tracker) {
      return { type: 'message', message: 'Context tracker not available.' };
    }

    const budget = tracker.evaluate(context.messagesRef.current);
    const pct = budget.usagePercent;
    const barLen = 30;
    const filled = Math.round((pct / 100) * barLen);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);

    const fmt = (n: number): string => `~${n.toLocaleString()}`;
    const available = budget.availableInput - budget.currentUsage;

    const lines = [
      'Context Window Usage:',
      '',
      `  [${bar}] ${pct}%`,
      '',
      `  Window:    ${budget.contextWindow.toLocaleString()} tokens`,
      `  Used:      ${fmt(budget.currentUsage)} tokens`,
      `  Available: ${fmt(Math.max(0, available))} tokens`,
      `  Messages:  ${context.messagesRef.current.length}`,
    ];

    return { type: 'message', message: lines.join('\n') };
  },
};
