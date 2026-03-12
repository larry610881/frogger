import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadCustomCommands } from '../custom-loader.js';
import { logger } from '../../utils/logger.js';
import type { SlashCommandContext } from '../types.js';

describe('loadCustomCommands', () => {
  let tmpDir: string;
  let fakeHome: string;
  const originalHomedir = os.homedir;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'custom-cmd-'));
    fakeHome = await fsp.mkdtemp(path.join(os.tmpdir(), 'custom-cmd-home-'));
    // Mock os.homedir to use fakeHome
    vi.spyOn(os, 'homedir').mockReturnValue(fakeHome);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fsp.rm(tmpDir, { recursive: true, force: true });
    await fsp.rm(fakeHome, { recursive: true, force: true });
  });

  it('returns empty array when no commands dirs exist', () => {
    const commands = loadCustomCommands(tmpDir);
    expect(commands).toEqual([]);
  });

  it('loads .md files from project commands dir', () => {
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'review.md'), 'Review the following code: $ARGUMENTS');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('review');
    expect(commands[0].description).toBe('Custom: review');
    expect(commands[0].usage).toBe('/review [arguments]');
  });

  it('loads .md files from global commands dir', () => {
    const globalDir = path.join(fakeHome, '.frogger', 'commands');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'roadmap.md'), 'Show the roadmap');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('roadmap');
  });

  it('merges global and project commands', () => {
    const globalDir = path.join(fakeHome, '.frogger', 'commands');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'global-cmd.md'), 'Global template');

    const projectDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'project-cmd.md'), 'Project template');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(2);
    const names = commands.map(c => c.name).sort();
    expect(names).toEqual(['global-cmd', 'project-cmd']);
  });

  it('project commands override global commands with the same name', () => {
    const globalDir = path.join(fakeHome, '.frogger', 'commands');
    fs.mkdirSync(globalDir, { recursive: true });
    fs.writeFileSync(path.join(globalDir, 'review.md'), 'Global review: $ARGUMENTS');

    const projectDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'review.md'), 'Project review: $ARGUMENTS');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('review');

    // Verify it uses the project template
    const messages: any[] = [];
    const context = { messagesRef: { current: messages } } as SlashCommandContext;
    commands[0].execute(['src/app.ts'], context);
    expect(messages[0].content).toBe('Project review: src/app.ts');
  });

  it('replaces $ARGUMENTS in template on execute', () => {
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'test.md'), 'Run tests for: $ARGUMENTS');

    const commands = loadCustomCommands(tmpDir);
    const cmd = commands[0];

    const messages: any[] = [];
    const context = {
      messagesRef: { current: messages },
    } as SlashCommandContext;

    const result = cmd.execute(['src/app.ts', '--verbose'], context);
    expect(result.type).toBe('message');
    expect(result.message).toBe('Running /test...');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Run tests for: src/app.ts --verbose');
  });

  it('warns when custom command shadows a built-in command', () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    // 'help' is a built-in command
    fs.writeFileSync(path.join(commandsDir, 'help.md'), 'Custom help: $ARGUMENTS');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('help');
    expect(warnSpy).toHaveBeenCalledWith(
      'Custom command "/help" shadows a built-in command',
    );
  });

  it('does not warn for non-colliding custom commands', () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'my-custom.md'), 'template');

    loadCustomCommands(tmpDir);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ignores non-.md files', () => {
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'review.md'), 'template');
    fs.writeFileSync(path.join(commandsDir, 'notes.txt'), 'not a command');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('review');
  });
});
