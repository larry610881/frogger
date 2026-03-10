import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadCustomCommands } from '../custom-loader.js';
import type { SlashCommandContext } from '../types.js';

describe('loadCustomCommands', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'custom-cmd-'));
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when commands dir does not exist', () => {
    const commands = loadCustomCommands(tmpDir);
    expect(commands).toEqual([]);
  });

  it('loads .md files as custom commands', () => {
    const commandsDir = path.join(tmpDir, '.frogger', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'review.md'), 'Review the following code: $ARGUMENTS');

    const commands = loadCustomCommands(tmpDir);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('review');
    expect(commands[0].description).toBe('Custom: review');
    expect(commands[0].usage).toBe('/review [arguments]');
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
