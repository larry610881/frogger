import { execa } from 'execa';
import type { SlashCommand } from './types.js';

export const undoCommand: SlashCommand = {
  name: 'undo',
  description: 'Revert the last git commit',
  usage: '/undo',

  async execute(_args, context) {
    const cwd = context.messagesRef.current.length > 0
      ? undefined
      : undefined;

    try {
      // Show what we're about to undo
      const logResult = await execa('git', ['log', '--oneline', '-1'], {
        reject: false,
      });

      if (logResult.exitCode !== 0) {
        return { type: 'error', message: 'Not a git repository or no commits found.' };
      }

      const lastCommit = logResult.stdout.trim();

      // Revert the last commit
      const revertResult = await execa('git', ['revert', 'HEAD', '--no-edit'], {
        reject: false,
      });

      if (revertResult.exitCode !== 0) {
        return {
          type: 'error',
          message: `Failed to revert: ${revertResult.stderr}\n\nYou may need to resolve conflicts manually.`,
        };
      }

      return {
        type: 'message',
        message: `Reverted commit: ${lastCommit}\n${revertResult.stdout}`,
      };
    } catch (err) {
      return {
        type: 'error',
        message: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
