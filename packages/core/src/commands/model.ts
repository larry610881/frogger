import type { SlashCommand } from './types.js';

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Switch provider/model',
  usage: '/model',
  execute: (_args, context) => {
    const choices: Array<{ provider: string; model: string; label: string }> = [];

    for (const p of context.providers) {
      // Only show providers that have an API key configured
      const envKey = p.envKey;
      const hasKey = !!(envKey && process.env[envKey]);
      if (!hasKey) continue;

      for (const m of p.models) {
        const isCurrent = p.name === context.currentProvider && m.name === context.currentModel;
        choices.push({
          provider: p.name,
          model: m.name,
          label: `${p.label} / ${m.name}${isCurrent ? ' (current)' : ''}`,
        });
      }
    }

    if (choices.length === 0) {
      return { type: 'error', message: 'No providers with API keys configured. Run /setup first.' };
    }

    return {
      type: 'interactive',
      message: 'Select model (use arrow keys):',
      choices,
    };
  },
};
