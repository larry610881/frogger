import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { SlashCommandContext } from '../types.js';
import { initProjectCommand } from '../init-project.js';
import { PROJECT_FILE } from '@frogger/shared';

function makeContext(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
  return {
    messagesRef: { current: [] },
    budgetTracker: null,
    model: null,
    providers: [],
    currentProvider: 'deepseek',
    currentModel: 'deepseek-chat',
    ...overrides,
  };
}

describe('initProjectCommand', () => {
  let tmpDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frogger-init-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates FROGGER.md with package.json info', () => {
    const pkg = {
      name: 'my-project',
      description: 'A test project',
      scripts: {
        build: 'tsc',
        test: 'vitest',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
    fs.mkdirSync(path.join(tmpDir, 'src'));

    const result = initProjectCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain(`Created ${PROJECT_FILE}`);

    const content = fs.readFileSync(path.join(tmpDir, PROJECT_FILE), 'utf-8');
    expect(content).toContain('Project: my-project');
    expect(content).toContain('Description: A test project');
    expect(content).toContain('`build`: `tsc`');
    expect(content).toContain('`test`: `vitest`');
    expect(content).toContain('src/');
  });

  it('generates FROGGER.md without package.json (directory structure only)', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Hello');

    const result = initProjectCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain(`Created ${PROJECT_FILE}`);

    const content = fs.readFileSync(path.join(tmpDir, PROJECT_FILE), 'utf-8');
    expect(content).toContain('docs/');
    expect(content).toContain('README.md');
    // Should not contain "Project:" since no package.json
    expect(content).not.toContain('Project:');
  });

  it('refuses to overwrite existing FROGGER.md', () => {
    fs.writeFileSync(path.join(tmpDir, PROJECT_FILE), '# Existing');

    const result = initProjectCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('already exists');
    expect(result.message).toContain('Delete it first');

    // Content should be unchanged
    const content = fs.readFileSync(path.join(tmpDir, PROJECT_FILE), 'utf-8');
    expect(content).toBe('# Existing');
  });

  it('excludes dotfiles and node_modules from directory listing', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    fs.mkdirSync(path.join(tmpDir, '.vscode'));
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    fs.mkdirSync(path.join(tmpDir, 'src'));
    fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=123');
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), '');

    initProjectCommand.execute([], makeContext());

    const content = fs.readFileSync(path.join(tmpDir, PROJECT_FILE), 'utf-8');
    expect(content).toContain('src/');
    expect(content).toContain('index.ts');
    expect(content).not.toContain('.git');
    expect(content).not.toContain('.vscode');
    expect(content).not.toContain('node_modules');
    expect(content).not.toContain('.env');
  });
});
