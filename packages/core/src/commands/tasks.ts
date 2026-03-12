import type { SlashCommand } from './types.js';
import type { BackgroundTaskInfo } from '../agent/background-task.js';

function formatElapsed(startedAt: number, completedAt?: number): string {
  const end = completedAt ?? Date.now();
  const secs = Math.round((end - startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m${secs % 60}s`;
}

const STATUS_ICON: Record<string, string> = {
  running: '...',
  completed: 'OK',
  failed: 'ERR',
  cancelled: 'X',
};

function formatTaskLine(t: BackgroundTaskInfo): string {
  const icon = STATUS_ICON[t.status] ?? t.status;
  const elapsed = formatElapsed(t.startedAt, t.completedAt);
  const promptPreview = t.prompt.length > 50 ? t.prompt.slice(0, 50) + '...' : t.prompt;
  return `  [${icon}] ${t.id} (${elapsed}) — ${promptPreview}`;
}

export const tasksCommand: SlashCommand = {
  name: 'tasks',
  description: 'List background tasks',
  usage: '/tasks',

  async execute(_args, context) {
    const manager = context.backgroundTaskManager;
    if (!manager) {
      return { type: 'error', message: 'Background task manager is not available.' };
    }

    const tasks = manager.list();
    if (tasks.length === 0) {
      return { type: 'message', message: 'No background tasks. Use /bg <prompt> to start one.' };
    }

    const lines = ['Background Tasks:', ''];
    for (const t of tasks) {
      lines.push(formatTaskLine(t));
    }

    const running = tasks.filter(t => t.status === 'running').length;
    lines.push('');
    lines.push(`Running: ${running} / Total: ${tasks.length}`);

    return { type: 'message', message: lines.join('\n') };
  },
};

export const taskCommand: SlashCommand = {
  name: 'task',
  description: 'View or cancel a background task',
  usage: '/task <id> | /task cancel <id>',

  async execute(args, context) {
    const manager = context.backgroundTaskManager;
    if (!manager) {
      return { type: 'error', message: 'Background task manager is not available.' };
    }

    if (args.length === 0) {
      return { type: 'error', message: 'Usage: /task <id> or /task cancel <id>' };
    }

    // Handle cancel subcommand
    if (args[0] === 'cancel') {
      const id = args[1];
      if (!id) {
        return { type: 'error', message: 'Usage: /task cancel <id>' };
      }
      const success = manager.cancel(id);
      if (success) {
        return { type: 'message', message: `Task ${id} cancelled.` };
      }
      return { type: 'error', message: `Task ${id} not found or not running.` };
    }

    // View task details
    const id = args[0];
    const task = manager.get(id);
    if (!task) {
      return { type: 'error', message: `Task ${id} not found.` };
    }

    const lines = [
      `Task: ${task.id}`,
      `Status: ${task.status}`,
      `Prompt: ${task.prompt}`,
      `Started: ${new Date(task.startedAt).toLocaleTimeString()}`,
      `Elapsed: ${formatElapsed(task.startedAt, task.completedAt)}`,
    ];

    if (task.error) {
      lines.push(`Error: ${task.error}`);
    }

    return { type: 'message', message: lines.join('\n') };
  },
};
