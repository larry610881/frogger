import { execa } from 'execa';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runAgent } from '../agent/agent.js';
import { loadConfig } from '../config/config.js';
import { createModel } from '../llm/provider.js';
import { buildSystemPrompt } from '../llm/system-prompt.js';
import { createToolRegistry } from '../tools/index.js';
import { ModeManager } from '../modes/manager.js';
import type { TokenUsage } from '@frogger/shared';

// ── Types ────────────────────────────────────────────────────────────

export interface SWEBenchTask {
  instance_id: string;
  repo: string;
  base_commit: string;
  problem_statement: string;
  test_patch: string;
  hints_text?: string;
}

export interface SWEBenchResult {
  instance_id: string;
  resolved: boolean;
  patch: string;
  error?: string;
  durationMs: number;
  steps: number;
  usage?: TokenUsage;
}

export interface SWEBenchReport {
  total: number;
  resolved: number;
  failed: number;
  errors: number;
  resolveRate: number;
  avgDurationMs: number;
  avgSteps: number;
  totalTokens: number;
  results: SWEBenchResult[];
}

export interface SWEBenchRunnerOptions {
  provider?: string;
  model?: string;
  /** Timeout per task in ms. Default: 600000 (10 min) */
  timeoutMs?: number;
  /** Max concurrent tasks. Default: 1 */
  concurrency?: number;
  /** Only run tasks matching these instance IDs */
  filter?: string[];
  /** Working directory for cloning repos */
  workDir?: string;
}

// ── Runner ───────────────────────────────────────────────────────────

export class SWEBenchRunner {
  constructor(private options: SWEBenchRunnerOptions = {}) {}

  /** Load tasks from JSON file */
  async loadTasks(path: string): Promise<SWEBenchTask[]> {
    const data = await readFile(path, 'utf-8');
    let tasks: SWEBenchTask[] = JSON.parse(data);
    if (this.options.filter?.length) {
      tasks = tasks.filter(t => this.options.filter!.includes(t.instance_id));
    }
    return tasks;
  }

  /** Run a single SWE-bench task */
  async runTask(task: SWEBenchTask): Promise<SWEBenchResult> {
    const timeoutMs = this.options.timeoutMs ?? 600_000;
    const workDir = this.options.workDir ?? '/tmp';
    const taskDir = join(workDir, `swe-bench-${task.instance_id}-${Date.now()}`);

    const start = performance.now();
    let steps = 0;
    let usage: TokenUsage | undefined;

    try {
      // 1. Clone repo and checkout base commit
      await mkdir(taskDir, { recursive: true });
      await execa('git', ['clone', '--depth=1', task.repo, taskDir]);
      await execa('git', ['fetch', '--depth=1', 'origin', task.base_commit], { cwd: taskDir });
      await execa('git', ['checkout', task.base_commit], { cwd: taskDir });

      // 2. Build prompt from problem statement
      const prompt = this.buildPrompt(task);

      // 3. Set up agent
      const config = loadConfig({ provider: this.options.provider, model: this.options.model });
      const model = createModel(config.provider, config.model, { apiKey: config.apiKey });
      const modeManager = new ModeManager('agent');
      const modeConfig = modeManager.getCurrentMode();
      const systemPrompt = buildSystemPrompt({ modeConfig, workingDirectory: taskDir });
      const registry = createToolRegistry(taskDir);
      const tools = registry.getTools([...modeConfig.allowedTools]);

      // 4. Run agent with timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        for await (const event of runAgent({
          model, systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          tools,
          abortSignal: controller.signal,
        })) {
          if (event.type === 'tool_call') steps++;
          if (event.type === 'done') usage = event.usage;
        }
      } finally {
        clearTimeout(timer);
      }

      // 5. Generate patch
      const patchResult = await execa('git', ['diff'], { cwd: taskDir });
      const patch = patchResult.stdout;

      if (!patch.trim()) {
        return {
          instance_id: task.instance_id, resolved: false, patch: '',
          error: 'No changes made',
          durationMs: Math.round(performance.now() - start), steps, usage,
        };
      }

      // 6. Apply test patch and run tests
      await writeFile(join(taskDir, 'test.patch'), task.test_patch);
      await execa('git', ['apply', 'test.patch'], { cwd: taskDir });

      // Run tests (detect framework)
      const testResult = await this.runTests(taskDir);
      const resolved = testResult.exitCode === 0;

      return {
        instance_id: task.instance_id,
        resolved,
        patch,
        durationMs: Math.round(performance.now() - start),
        steps,
        usage,
      };
    } catch (err) {
      return {
        instance_id: task.instance_id,
        resolved: false,
        patch: '',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - start),
        steps,
        usage,
      };
    }
  }

  /** Run all tasks and generate report */
  async runAll(tasks: SWEBenchTask[]): Promise<SWEBenchReport> {
    const results: SWEBenchResult[] = [];

    // Sequential for now (concurrency=1)
    for (const task of tasks) {
      const result = await this.runTask(task);
      results.push(result);
    }

    return this.generateReport(results);
  }

  /** @internal Exposed for testing */
  buildPrompt(task: SWEBenchTask): string {
    let prompt = `Fix the following issue in this repository:\n\n${task.problem_statement}`;
    if (task.hints_text) {
      prompt += `\n\nHints:\n${task.hints_text}`;
    }
    prompt += '\n\nInstructions:\n1. Explore the repository to understand the codebase\n2. Locate the relevant files\n3. Make the minimal changes needed to fix the issue\n4. Do NOT run tests — just make the code changes';
    return prompt;
  }

  /** @internal Exposed for testing */
  async runTests(cwd: string) {
    // Try pytest first (most SWE-bench repos are Python)
    try {
      return await execa('python', ['-m', 'pytest', '-x', '-q'], { cwd, timeout: 120_000, reject: false });
    } catch {
      // Fallback to generic test
      return { exitCode: 1, stdout: '', stderr: 'No test framework found' } as any;
    }
  }

  /** @internal Exposed for testing */
  generateReport(results: SWEBenchResult[]): SWEBenchReport {
    const resolved = results.filter(r => r.resolved).length;
    const errors = results.filter(r => r.error).length;
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
    const totalSteps = results.reduce((sum, r) => sum + r.steps, 0);
    const totalTokens = results.reduce((sum, r) => sum + (r.usage?.totalTokens ?? 0), 0);

    return {
      total: results.length,
      resolved,
      failed: results.length - resolved - errors,
      errors,
      resolveRate: results.length > 0 ? resolved / results.length : 0,
      avgDurationMs: results.length > 0 ? Math.round(totalDuration / results.length) : 0,
      avgSteps: results.length > 0 ? Math.round(totalSteps / results.length) : 0,
      totalTokens,
      results,
    };
  }
}
