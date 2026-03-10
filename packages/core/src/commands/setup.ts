import type { SlashCommand } from './types.js';

export const setupCommand: SlashCommand = {
  name: 'setup',
  description: 'Configure API key and provider',
  usage: '/setup',
  execute: (_args, context) => {
    context.onTriggerSetup?.();
    return { type: 'message', message: 'Opening setup...' };
  },
};
