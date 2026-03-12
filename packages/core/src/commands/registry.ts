import type { SlashCommand, SlashCommandContext, SlashCommandResult } from './types.js';

/** Names reserved by built-in commands. Custom commands with these names trigger a warning. */
export const BUILT_IN_COMMANDS = new Set([
  'help', 'clear', 'compact', 'compact-threshold', 'model', 'setup',
  'undo', 'sessions', 'resume', 'git-auth', 'rewind', 'remember',
  'mcp', 'cost', 'init', 'update',
]);

export class CommandRegistry {
  private commands = new Map<string, SlashCommand>();

  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  /** Check if input starts with '/' */
  isCommand(input: string): boolean {
    return input.trimStart().startsWith('/');
  }

  /** Get all command definitions for autocomplete */
  getCommandList(): Array<{ name: string; description: string }> {
    const list: Array<{ name: string; description: string }> = [
      { name: 'help', description: 'List all available commands' },
    ];
    for (const cmd of this.commands.values()) {
      list.push({ name: cmd.name, description: cmd.description });
    }
    return list;
  }

  /** Get matching commands for a prefix (without the leading /) */
  getCompletions(prefix: string): Array<{ name: string; description: string }> {
    const lower = prefix.toLowerCase();
    return this.getCommandList().filter(c => c.name.startsWith(lower));
  }

  /** Parse and execute a slash command. Returns null if command not found. */
  async execute(input: string, context: SlashCommandContext): Promise<SlashCommandResult | null> {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.slice(1).split(/\s+/);
    const name = parts[0];
    const args = parts.slice(1);

    if (!name) return null;

    // Built-in /help
    if (name === 'help') {
      return this.helpCommand();
    }

    const command = this.commands.get(name);
    if (!command) {
      return { type: 'error', message: `Unknown command: /${name}. Type /help for available commands.` };
    }

    return command.execute(args, context);
  }

  private helpCommand(): SlashCommandResult {
    const lines = ['Available commands:', ''];
    // Built-in help
    lines.push('  /help                     — List all available commands');

    for (const cmd of this.commands.values()) {
      const padded = cmd.usage.padEnd(28);
      lines.push(`  ${padded}— ${cmd.description}`);
    }

    return { type: 'message', message: lines.join('\n') };
  }
}
