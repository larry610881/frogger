import { join } from 'node:path';
import { execa } from 'execa';
import type { BenchmarkTask } from '../types.js';

const CALCULATOR_JS = `// calculator.js — a simple calculator module

function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return b - a;  // BUG: operands are reversed
}

function multiply(a, b) {
  return a * b;
}

function divide(a, b) {
  return Math.floor(a / b);  // BUG: integer division instead of float
}

module.exports = { add, subtract, multiply, divide };
`;

const CALCULATOR_TEST_JS = `// calculator.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { add, subtract, multiply, divide } = require('./calculator.js');

describe('calculator', () => {
  it('should add two numbers', () => {
    assert.strictEqual(add(2, 3), 5);
    assert.strictEqual(add(-1, 1), 0);
  });

  it('should subtract two numbers', () => {
    assert.strictEqual(subtract(5, 3), 2);
    assert.strictEqual(subtract(10, 4), 6);
  });

  it('should multiply two numbers', () => {
    assert.strictEqual(multiply(3, 4), 12);
    assert.strictEqual(multiply(-2, 5), -10);
  });

  it('should divide two numbers', () => {
    assert.strictEqual(divide(10, 3), 10 / 3);
    assert.strictEqual(divide(7, 2), 3.5);
  });
});
`;

export const debugTask: BenchmarkTask = {
  name: 'debug',
  difficulty: 'medium',
  description: 'Fix bugs in a calculator module to make all tests pass',
  prompt:
    'The calculator.js file has bugs. The tests in calculator.test.js are failing. Fix the bugs so all tests pass.',
  seedFiles: {
    'calculator.js': CALCULATOR_JS,
    'calculator.test.js': CALCULATOR_TEST_JS,
  },
  validate: async (dir: string) => {
    try {
      await execa('node', ['--test', join(dir, 'calculator.test.js')]);
      return { pass: true, message: 'All calculator tests pass' };
    } catch (err) {
      const msg = err instanceof Error ? (err as any).stderr || err.message : String(err);
      return { pass: false, message: `Tests failed: ${String(msg).slice(0, 500)}` };
    }
  },
};
