import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import type { BenchmarkTask } from '../types.js';

export const snakeTask: BenchmarkTask = {
  name: 'snake',
  difficulty: 'medium',
  description: 'Create a terminal snake game using Node.js',
  prompt:
    'Create a snake game in a single file called snake.js using Node.js. It should use process.stdin for input and process.stdout for rendering. The game should have a snake that moves, grows when eating food, and ends when hitting walls or itself.',
  validate: async (dir: string) => {
    const filePath = join(dir, 'snake.js');

    try {
      await stat(filePath);
    } catch {
      return { pass: false, message: 'snake.js does not exist' };
    }

    // Syntax check
    try {
      await execa('node', ['--check', filePath]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { pass: false, message: `Syntax error in snake.js: ${msg}` };
    }

    // Line count check
    const content = await readFile(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    if (lineCount <= 50) {
      return {
        pass: false,
        message: `snake.js has only ${lineCount} lines (expected > 50)`,
      };
    }

    return {
      pass: true,
      message: `snake.js passes syntax check with ${lineCount} lines`,
    };
  },
};
