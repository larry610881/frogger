import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TokenUsage } from '@frogger/shared';
import { runAgent } from '../agent/agent.js';
import { loadConfig } from '../config/config.js';
import { createModel } from '../llm/provider.js';
import { buildSystemPrompt } from '../llm/system-prompt.js';
import { createToolRegistry } from '../tools/index.js';
import { ModeManager } from '../modes/manager.js';
import type { BenchmarkTask, BenchmarkResult } from './types.js';

export interface BenchmarkRunnerOptions {
  provider?: string;
  model?: string;
  /** Timeout in milliseconds for each benchmark run. Defaults to 300000 (5 minutes). */
  timeout?: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

export class BenchmarkRunner {
  private config;
  private timeout: number;

  constructor(options?: BenchmarkRunnerOptions) {
    this.config = loadConfig({
      provider: options?.provider,
      model: options?.model,
    });
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  async run(task: BenchmarkTask): Promise<BenchmarkResult> {
    const timestamp = Date.now();
    const workDir = join('/tmp', `frogger-bench-${timestamp}-${task.name}`);
    await mkdir(workDir, { recursive: true });

    // Write seed files
    if (task.seedFiles) {
      for (const [filename, content] of Object.entries(task.seedFiles)) {
        await writeFile(join(workDir, filename), content, 'utf-8');
      }
    }

    const start = performance.now();
    let usage: TokenUsage | undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Set up agent infrastructure
      const model = createModel(this.config.provider, this.config.model, {
        apiKey: this.config.apiKey,
      });
      const modeManager = new ModeManager('agent');
      const modeConfig = modeManager.getCurrentMode();
      const systemPrompt = buildSystemPrompt({
        modeConfig,
        workingDirectory: workDir,
      });
      const registry = createToolRegistry(workDir);
      const tools = registry.getTools([...modeConfig.allowedTools]);

      // Run the agent
      for await (const event of runAgent({
        model,
        systemPrompt,
        messages: [{ role: 'user', content: task.prompt }],
        tools,
        abortSignal: controller.signal,
      })) {
        if (event.type === 'done') {
          usage = event.usage;
        }
        // Silently consume all other events
      }
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);

      // Check if this was a timeout abort
      if (controller.signal.aborted) {
        const timeoutSec = Math.round(this.timeout / 1000);
        return {
          task: task.name,
          difficulty: task.difficulty,
          pass: false,
          message: `Timeout after ${timeoutSec}s`,
          durationMs,
          usage,
        };
      }

      const msg = err instanceof Error ? err.message : String(err);
      return {
        task: task.name,
        difficulty: task.difficulty,
        pass: false,
        message: `Agent error: ${msg}`,
        durationMs,
        usage,
      };
    } finally {
      clearTimeout(timer);
    }

    const durationMs = Math.round(performance.now() - start);

    // Validate the result
    const validation = await task.validate(workDir);

    return {
      task: task.name,
      difficulty: task.difficulty,
      pass: validation.pass,
      message: validation.message,
      durationMs,
      usage,
    };
  }
}
