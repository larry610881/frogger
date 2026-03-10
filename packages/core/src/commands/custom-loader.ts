import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from '@frogger/shared';
import type { SlashCommand, SlashCommandContext, SlashCommandResult } from './types.js';

/**
 * Load custom slash commands from `.frogger/commands/*.md` in the working directory.
 * Each `.md` file becomes a command named after the filename (without extension).
 * Template files support `$ARGUMENTS` variable substitution.
 */
export function loadCustomCommands(workingDirectory: string): SlashCommand[] {
  const commandsDir = path.join(workingDirectory, CONFIG_DIR, 'commands');
  if (!fs.existsSync(commandsDir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(commandsDir);
  } catch {
    return [];
  }

  return entries
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const name = path.basename(filename, '.md');
      const template = fs.readFileSync(path.join(commandsDir, filename), 'utf-8');
      return {
        name,
        description: `Custom: ${name}`,
        usage: `/${name} [arguments]`,
        execute(args: string[], context: SlashCommandContext): SlashCommandResult {
          const content = template.replace(/\$ARGUMENTS/g, args.join(' '));
          context.messagesRef.current.push({ role: 'user', content } as any);
          return { type: 'message', message: `Running /${name}...` };
        },
      };
    });
}
