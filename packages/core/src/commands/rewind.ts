import type { SlashCommand } from './types.js';
import type { CheckpointManager } from '../agent/checkpoint.js';

export function createRewindCommand(checkpointManager: CheckpointManager): SlashCommand {
  return {
    name: 'rewind',
    description: 'Rewind to a previous checkpoint',
    usage: '/rewind [last|<id>]',

    async execute(args) {
      const checkpoints = checkpointManager.getCheckpoints();

      if (checkpoints.length === 0) {
        return { type: 'message', message: 'No checkpoints available.' };
      }

      // No args: show checkpoint list
      if (args.length === 0) {
        const lines = ['Checkpoints:', ''];
        for (const cp of checkpoints) {
          const time = new Date(cp.timestamp).toLocaleTimeString();
          const files = cp.fileSnapshots.map(s => s.path).join(', ');
          lines.push(`  #${cp.id}  ${cp.toolName}  ${time}  [${files || 'no files'}]`);
        }
        lines.push('', 'Usage: /rewind last  or  /rewind <id>');
        return { type: 'message', message: lines.join('\n') };
      }

      // Determine target checkpoint
      let targetId: number;
      if (args[0] === 'last') {
        targetId = checkpoints[checkpoints.length - 1]!.id;
      } else {
        targetId = parseInt(args[0]!, 10);
        if (isNaN(targetId)) {
          return { type: 'error', message: `Invalid checkpoint id: ${args[0]}` };
        }
      }

      try {
        const result = await checkpointManager.restoreCheckpoint(targetId);
        const parts = [`Rewound to checkpoint #${targetId}.`];

        if (result.restoredFiles.length > 0) {
          parts.push(`Restored: ${result.restoredFiles.join(', ')}`);
        }
        if (result.deletedFiles.length > 0) {
          parts.push(`Deleted: ${result.deletedFiles.join(', ')}`);
        }

        return {
          type: 'message',
          message: parts.join('\n'),
          messageIndex: result.messageIndex,
        };
      } catch (err) {
        return {
          type: 'error',
          message: `Rewind failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
