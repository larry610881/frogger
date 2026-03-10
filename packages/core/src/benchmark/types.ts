import type { TokenUsage } from '@frogger/shared';

export interface BenchmarkTask {
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  prompt: string;
  seedFiles?: Record<string, string>;
  validate: (dir: string) => Promise<BenchmarkValidation>;
}

export interface BenchmarkValidation {
  pass: boolean;
  message: string;
}

export interface BenchmarkResult {
  task: string;
  difficulty: string;
  pass: boolean;
  message: string;
  durationMs: number;
  usage?: TokenUsage;
}
