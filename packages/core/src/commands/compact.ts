import type { SlashCommand } from './types.js';
import { compactMessages } from '../agent/compact.js';
import { COMPACT_PRESERVE_RECENT } from '@frogger/shared';

export const compactCommand: SlashCommand = {
  name: 'compact',
  description: 'Manually compact conversation context',
  usage: '/compact',
  execute: async (_args, context) => {
    if (!context.model) {
      return { type: 'error', message: 'No model configured. Run /setup first.' };
    }

    const messages = context.messagesRef.current;
    if (messages.length <= COMPACT_PRESERVE_RECENT) {
      return { type: 'message', message: 'Not enough messages to compact.' };
    }

    const result = await compactMessages(context.model, messages);
    context.messagesRef.current = result.messages;
    context.onCompactDone?.(result.summary, result.compactedCount);

    return {
      type: 'message',
      message: `Compacted ${result.compactedCount} messages into summary.`,
    };
  },
};
