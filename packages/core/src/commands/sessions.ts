import { SessionManager } from '../agent/session.js';
import type { SlashCommand } from './types.js';

export const sessionsCommand: SlashCommand = {
  name: 'sessions',
  description: 'List recent conversation sessions',
  usage: '/sessions',

  async execute() {
    const manager = new SessionManager();
    const sessions = await manager.list(10);

    if (sessions.length === 0) {
      return { type: 'message', message: 'No saved sessions found.' };
    }

    const lines = ['Recent sessions:', ''];
    for (const s of sessions) {
      const date = new Date(s.updatedAt).toLocaleString();
      const dir = s.workingDirectory.replace(process.env.HOME ?? '', '~');
      const tokens = s.totalTokens.toLocaleString();
      const msgs = s.messages.length;
      lines.push(`  ${s.id}`);
      lines.push(`    ${date} | ${dir} | ${msgs} msgs | ${tokens} tokens`);
      lines.push(`    ${s.provider}/${s.model}`);
      lines.push('');
    }
    lines.push('Use /resume <id> or /resume latest to restore a session.');

    return { type: 'message', message: lines.join('\n') };
  },
};
