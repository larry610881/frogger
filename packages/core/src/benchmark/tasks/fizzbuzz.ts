import { join } from 'node:path';
import { execa } from 'execa';
import type { BenchmarkTask } from '../types.js';

const EXPECTED_FIRST_20 = [
  '1', '2', 'Fizz', '4', 'Buzz',
  'Fizz', '7', '8', 'Fizz', 'Buzz',
  '11', 'Fizz', '13', '14', 'FizzBuzz',
  '16', '17', 'Fizz', '19', 'Buzz',
];

export const fizzbuzzTask: BenchmarkTask = {
  name: 'fizzbuzz',
  difficulty: 'easy',
  description: 'Create a FizzBuzz program that prints 1 to 100',
  prompt:
    'Create a file called fizzbuzz.js that prints FizzBuzz from 1 to 100. Each number on its own line. Print \'Fizz\' for multiples of 3, \'Buzz\' for multiples of 5, and \'FizzBuzz\' for multiples of both.',
  validate: async (dir: string) => {
    try {
      const { stdout } = await execa('node', [join(dir, 'fizzbuzz.js')]);
      const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);

      for (let i = 0; i < EXPECTED_FIRST_20.length; i++) {
        if (lines[i] !== EXPECTED_FIRST_20[i]) {
          return {
            pass: false,
            message: `Line ${i + 1}: expected "${EXPECTED_FIRST_20[i]}", got "${lines[i] ?? '(missing)'}"`,
          };
        }
      }

      return { pass: true, message: 'FizzBuzz output matches expected first 20 lines' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { pass: false, message: `Failed to run fizzbuzz.js: ${msg}` };
    }
  },
};
