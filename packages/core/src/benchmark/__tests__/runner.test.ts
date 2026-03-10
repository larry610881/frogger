import { join } from 'node:path';
import type { BenchmarkTask } from '../types.js';

// ── Hoisted mocks ──────────────────────────────────────────────────────
const {
  mockLoadConfig,
  mockCreateModel,
  mockBuildSystemPrompt,
  mockCreateToolRegistry,
  mockGetTools,
  mockRunAgent,
  mockMkdir,
  mockWriteFile,
} = vi.hoisted(() => {
  const mockGetTools = vi.fn().mockReturnValue({ 'read-file': {}, 'write-file': {} });
  return {
    mockLoadConfig: vi.fn().mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    }),
    mockCreateModel: vi.fn().mockReturnValue({ id: 'fake-model' }),
    mockBuildSystemPrompt: vi.fn().mockReturnValue('You are an AI agent.'),
    mockCreateToolRegistry: vi.fn().mockReturnValue({ getTools: mockGetTools }),
    mockGetTools,
    mockRunAgent: vi.fn(),
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../config/config.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../../llm/provider.js', () => ({
  createModel: mockCreateModel,
}));

vi.mock('../../llm/system-prompt.js', () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
}));

vi.mock('../../tools/index.js', () => ({
  createToolRegistry: mockCreateToolRegistry,
}));

vi.mock('../../modes/manager.js', () => {
  class MockModeManager {
    getCurrentMode() {
      return {
        name: 'agent',
        displayName: 'Agent',
        allowedTools: ['read-file', 'write-file', 'bash'],
        approvalPolicy: 'auto',
        systemPromptSuffix: '',
      };
    }
  }
  return { ModeManager: MockModeManager };
});

vi.mock('../../agent/agent.js', () => ({
  runAgent: mockRunAgent,
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

import { BenchmarkRunner } from '../runner.js';

// ── Helpers ────────────────────────────────────────────────────────────

async function* fakeAgentStream(events: Array<{ type: string; [k: string]: unknown }>) {
  for (const event of events) {
    yield event;
  }
}

function makeTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    name: 'test-task',
    difficulty: 'easy',
    description: 'A simple test task',
    prompt: 'Write hello world',
    validate: vi.fn().mockResolvedValue({ pass: true, message: 'All good' }),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('BenchmarkRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock return values after clearAllMocks
    mockLoadConfig.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });
    mockCreateModel.mockReturnValue({ id: 'fake-model' });
    mockBuildSystemPrompt.mockReturnValue('You are an AI agent.');
    mockGetTools.mockReturnValue({ 'read-file': {}, 'write-file': {} });
    mockCreateToolRegistry.mockReturnValue({ getTools: mockGetTools });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRunAgent.mockReturnValue(fakeAgentStream([{ type: 'done', usage: undefined }]));
  });

  // ── Constructor ────────────────────────────────────────────────────

  describe('constructor', () => {
    it('calls loadConfig with provided options', () => {
      new BenchmarkRunner({ provider: 'openai', model: 'gpt-4o' });

      expect(mockLoadConfig).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-4o',
      });
    });

    it('calls loadConfig with undefined values when no options provided', () => {
      new BenchmarkRunner();

      expect(mockLoadConfig).toHaveBeenCalledWith({
        provider: undefined,
        model: undefined,
      });
    });
  });

  // ── run() ──────────────────────────────────────────────────────────

  describe('run()', () => {
    it('creates temp directory with recursive flag', async () => {
      const runner = new BenchmarkRunner();
      const task = makeTask();

      await runner.run(task);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/frogger-bench-\d+-test-task$/),
        { recursive: true },
      );
    });

    it('writes seed files when provided', async () => {
      const runner = new BenchmarkRunner();
      const task = makeTask({
        seedFiles: {
          'index.ts': 'console.log("hello")',
          'README.md': '# Test',
        },
      });

      await runner.run(task);

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('index.ts'),
        'console.log("hello")',
        'utf-8',
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('README.md'),
        '# Test',
        'utf-8',
      );
    });

    it('does not write seed files when none provided', async () => {
      const runner = new BenchmarkRunner();
      const task = makeTask({ seedFiles: undefined });

      await runner.run(task);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('returns pass=true when validation passes', async () => {
      const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'text_delta', text: 'hello' },
        { type: 'done', usage },
      ]));

      const runner = new BenchmarkRunner();
      const validate = vi.fn().mockResolvedValue({ pass: true, message: 'Looks correct' });
      const task = makeTask({ validate });

      const result = await runner.run(task);

      expect(result.pass).toBe(true);
      expect(result.message).toBe('Looks correct');
      expect(result.task).toBe('test-task');
      expect(result.difficulty).toBe('easy');
      expect(validate).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/frogger-bench-\d+-test-task$/),
      );
    });

    it('returns pass=false when validation fails', async () => {
      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'done', usage: undefined },
      ]));

      const runner = new BenchmarkRunner();
      const validate = vi.fn().mockResolvedValue({ pass: false, message: 'File not found' });
      const task = makeTask({ difficulty: 'hard', validate });

      const result = await runner.run(task);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('File not found');
      expect(result.difficulty).toBe('hard');
    });

    it('catches agent errors and returns pass=false with error message', async () => {
      mockRunAgent.mockImplementation(() => {
        throw new Error('LLM API rate limit exceeded');
      });

      const runner = new BenchmarkRunner();
      const validate = vi.fn();
      const task = makeTask({ validate });

      const result = await runner.run(task);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Agent error: LLM API rate limit exceeded');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // validate should NOT be called when agent throws
      expect(validate).not.toHaveBeenCalled();
    });

    it('catches non-Error throws and returns stringified message', async () => {
      mockRunAgent.mockImplementation(() => {
        throw 'unexpected string error';
      });

      const runner = new BenchmarkRunner();
      const task = makeTask();

      const result = await runner.run(task);

      expect(result.pass).toBe(false);
      expect(result.message).toBe('Agent error: unexpected string error');
    });

    it('records duration and usage from done event', async () => {
      const usage = { promptTokens: 200, completionTokens: 80, totalTokens: 280 };
      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'text_delta', text: 'working...' },
        { type: 'tool_call', name: 'write-file' },
        { type: 'done', usage },
      ]));

      const runner = new BenchmarkRunner();
      const task = makeTask();

      const result = await runner.run(task);

      expect(result.usage).toEqual(usage);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });

    it('returns undefined usage when done event has no usage', async () => {
      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'text_delta', text: 'done' },
      ]));

      const runner = new BenchmarkRunner();
      const task = makeTask();

      const result = await runner.run(task);

      expect(result.usage).toBeUndefined();
    });
  });

  // ── Timeout ───────────────────────────────────────────────────────

  describe('timeout', () => {
    it('accepts a custom timeout option', () => {
      const runner = new BenchmarkRunner({ timeout: 60_000 });
      // @ts-expect-error — accessing private field for test assertion
      expect(runner.timeout).toBe(60_000);
    });

    it('defaults timeout to 300000ms (5 minutes)', () => {
      const runner = new BenchmarkRunner();
      // @ts-expect-error — accessing private field for test assertion
      expect(runner.timeout).toBe(300_000);
    });

    it('aborts agent and returns pass=false when timeout elapses', async () => {
      // Mock runAgent with an async generator that never completes
      mockRunAgent.mockImplementation((_opts: { abortSignal?: AbortSignal }) => {
        const opts = _opts;
        return (async function* () {
          yield { type: 'text_delta', text: 'thinking...' };
          // Wait until aborted, simulating an infinite agent loop
          await new Promise<void>((resolve, reject) => {
            if (opts.abortSignal?.aborted) {
              reject(opts.abortSignal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
              return;
            }
            opts.abortSignal?.addEventListener('abort', () => {
              reject(opts.abortSignal!.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
            });
          });
        })();
      });

      const runner = new BenchmarkRunner({ timeout: 100 });
      const validate = vi.fn();
      const task = makeTask({ validate });

      const result = await runner.run(task);

      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/Timeout after \d+s/);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // validate should NOT be called when timeout occurs
      expect(validate).not.toHaveBeenCalled();
    });

    it('clears timeout on normal completion (no spurious abort)', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      ]));

      const runner = new BenchmarkRunner({ timeout: 60_000 });
      const task = makeTask();

      const result = await runner.run(task);

      expect(result.pass).toBe(true);
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });

    it('passes abortSignal to runAgent', async () => {
      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'done', usage: undefined },
      ]));

      const runner = new BenchmarkRunner({ timeout: 5000 });
      const task = makeTask();

      await runner.run(task);

      expect(mockRunAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal),
        }),
      );
    });
  });
});
