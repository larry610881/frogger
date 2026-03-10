import type { BenchmarkTask } from '../types.js';
import { helloTask } from './hello.js';
import { fizzbuzzTask } from './fizzbuzz.js';
import { snakeTask } from './snake.js';
import { debugTask } from './debug.js';
import { refactorTask } from './refactor.js';

const taskMap = new Map<string, BenchmarkTask>([
  [helloTask.name, helloTask],
  [fizzbuzzTask.name, fizzbuzzTask],
  [snakeTask.name, snakeTask],
  [debugTask.name, debugTask],
  [refactorTask.name, refactorTask],
]);

export function getAllTasks(): BenchmarkTask[] {
  return Array.from(taskMap.values());
}

export function getTask(name: string): BenchmarkTask | undefined {
  return taskMap.get(name);
}
