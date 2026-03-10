import type { SlashCommand } from './types.js';

export const clearCommand: SlashCommand = {
  name: 'clear',
  description: 'Clear all conversation context',
  usage: '/clear',
  execute: (_args, context) => {
    context.messagesRef.current = [];
    context.onClearHistory?.();
    return { type: 'message', message: 'Context cleared.' };
  },
};
