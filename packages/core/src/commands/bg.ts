import type { SlashCommand } from './types.js';

export const bgCommand: SlashCommand = {
  name: 'bg',
  description: 'Start a background task',
  usage: '/bg <prompt>',

  async execute(args, context) {
    const prompt = args.join(' ').trim();
    if (!prompt) {
      return { type: 'error', message: 'Usage: /bg <prompt> — provide a prompt for the background task.' };
    }

    const manager = context.backgroundTaskManager;
    if (!manager) {
      return { type: 'error', message: 'Background task manager is not available.' };
    }

    const createAgent = context.createBackgroundAgent;
    if (!createAgent) {
      return { type: 'error', message: 'Background agent factory is not available.' };
    }

    try {
      const runner = createAgent(prompt);
      const id = manager.start(prompt, runner);
      return { type: 'message', message: `Background task started: ${id}\nPrompt: ${prompt}\n\nUse /tasks to list tasks, /task ${id} for details, /task cancel ${id} to cancel.` };
    } catch (err) {
      return { type: 'error', message: err instanceof Error ? err.message : String(err) };
    }
  },
};
