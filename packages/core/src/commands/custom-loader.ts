import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CONFIG_DIR } from '@frogger/shared';
import { logger } from '../utils/logger.js';
import { BUILT_IN_COMMANDS } from './registry.js';
import type { SlashCommand, SlashCommandContext, SlashCommandResult } from './types.js';

/**
 * Load `.md` files from a single directory as custom slash commands.
 */
function loadCommandsFromDir(dir: string): SlashCommand[] {
  if (!fs.existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const name = path.basename(filename, '.md');
      const template = fs.readFileSync(path.join(dir, filename), 'utf-8');
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

/**
 * Load custom slash commands from `~/.frogger/commands/*.md` (global)
 * and `.frogger/commands/*.md` (project).
 *
 * Project commands override global commands with the same name.
 */
export function loadCustomCommands(workingDirectory: string): SlashCommand[] {
  const globalDir = path.join(os.homedir(), CONFIG_DIR, 'commands');
  const projectDir = path.join(workingDirectory, CONFIG_DIR, 'commands');

  const globalCommands = loadCommandsFromDir(globalDir);
  const projectCommands = loadCommandsFromDir(projectDir);

  // Project commands override global commands with the same name
  const commandMap = new Map<string, SlashCommand>();
  for (const cmd of globalCommands) commandMap.set(cmd.name, cmd);
  for (const cmd of projectCommands) commandMap.set(cmd.name, cmd);

  // Warn about collisions with built-in commands (still load them — don't block)
  for (const cmd of commandMap.values()) {
    if (BUILT_IN_COMMANDS.has(cmd.name)) {
      logger.warn(`Custom command "/${cmd.name}" shadows a built-in command`);
    }
  }

  return Array.from(commandMap.values());
}
