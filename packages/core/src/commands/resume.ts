import { SessionManager } from '../agent/session.js';
import type { SlashCommand } from './types.js';

export const resumeCommand: SlashCommand = {
  name: 'resume',
  description: 'Resume a previous session',
  usage: '/resume <id|latest>',

  async execute(args, context) {
    const idArg = args[0];
    if (!idArg) {
      return { type: 'error', message: 'Usage: /resume <session-id> or /resume latest' };
    }

    const manager = new SessionManager();
    const session = idArg === 'latest'
      ? await manager.getLatest()
      : await manager.load(idArg);

    if (!session) {
      return { type: 'error', message: `Session not found: ${idArg}` };
    }

    // Restore messages into the current conversation
    context.messagesRef.current = [...session.messages];

    const date = new Date(session.updatedAt).toLocaleString();
    const msgs = session.messages.length;

    return {
      type: 'message',
      message: `Session restored: ${session.id}\n  From: ${date}\n  Messages: ${msgs}\n  Provider: ${session.provider}/${session.model}\n\nConversation history has been restored. Continue from where you left off.`,
    };
  },
};
