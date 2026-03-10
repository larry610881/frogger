import type { SlashCommand } from './types.js';

export const compactThresholdCommand: SlashCommand = {
  name: 'compact-threshold',
  description: 'Set auto-compact threshold percentage (10-100)',
  usage: '/compact-threshold <N>',
  execute: (args, context) => {
    if (args.length === 0) {
      const current = context.budgetTracker?.getCompactThreshold() ?? 80;
      return { type: 'message', message: `Current compact threshold: ${current}%` };
    }

    const value = parseInt(args[0], 10);
    if (isNaN(value) || value < 10 || value > 100) {
      return { type: 'error', message: 'Threshold must be a number between 10 and 100.' };
    }

    context.budgetTracker?.setCompactThreshold(value);
    return { type: 'message', message: `Compact threshold set to ${value}%.` };
  },
};
