import type { SlashCommand } from './types.js';

export const rememberCommand: SlashCommand = {
  name: 'remember',
  description: 'Ask the AI to save a memory note',
  usage: '/remember <what to remember>',
  execute(args, context) {
    const text = args.join(' ').trim();
    if (!text) return { type: 'message', message: 'Usage: /remember <what to remember>' };
    context.messagesRef.current.push({
      role: 'user',
      content: `Please save the following to memory using the save-memory tool: ${text}`,
    } as any);
    return { type: 'message', message: 'Saving memory...' };
  },
};
