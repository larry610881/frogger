import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BenchmarkTask } from '../types.js';

export const helloTask: BenchmarkTask = {
  name: 'hello',
  difficulty: 'easy',
  description: 'Create a hello.txt file with "Hello, World!" content',
  prompt:
    'Create a file called hello.txt in the current directory with the content \'Hello, World!\'',
  validate: async (dir: string) => {
    try {
      const content = await readFile(join(dir, 'hello.txt'), 'utf-8');
      if (content.toLowerCase().includes('hello world') || content.toLowerCase().includes('hello, world')) {
        return { pass: true, message: 'hello.txt exists with correct content' };
      }
      return {
        pass: false,
        message: `hello.txt content mismatch: "${content.trim()}"`,
      };
    } catch {
      return { pass: false, message: 'hello.txt does not exist' };
    }
  },
};
