import { join } from 'node:path';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const {
  mockExeca,
  mockMkdir,
  mockWriteFile,
  mockReadFile,
  mockLoadConfig,
  mockCreateModel,
  mockBuildSystemPrompt,
  mockCreateToolRegistry,
  mockGetTools,
  mockRunAgent,
} = vi.hoisted(() => {
  const mockGetTools = vi.fn().mockReturnValue({ 'read-file': {}, 'write-file': {} });
  return {
    mockExeca: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockReadFile: vi.fn().mockResolvedValue('[]'),
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
  };
});

vi.mock('execa', () => ({
  execa: mockExeca,
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
}));

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

import { SWEBenchRunner } from '../swe-bench.js';
import type { SWEBenchTask, SWEBenchResult } from '../swe-bench.js';

// ── Helpers ────────────────────────────────────────────────────────────

async function* fakeAgentStream(events: Array<{ type: string; [k: string]: unknown }>) {
  for (const event of events) {
    yield event;
  }
}

function makeTask(overrides?: Partial<SWEBenchTask>): SWEBenchTask {
  return {
    instance_id: 'sample__test-1',
    repo: 'https://github.com/example/test-repo',
    base_commit: 'abc123',
    problem_statement: 'The add function returns wrong result.',
    test_patch: '--- a/test.py\n+++ b/test.py\n@@ -0,0 +1 @@\n+assert True\n',
    ...overrides,
  };
}

const sampleTasksJson = JSON.stringify([
  makeTask(),
  makeTask({ instance_id: 'sample__test-2', problem_statement: 'Second issue' }),
  makeTask({ instance_id: 'sample__test-3', problem_statement: 'Third issue' }),
]);

// ── Tests ──────────────────────────────────────────────────────────────

describe('SWEBenchRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(sampleTasksJson);
    mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockLoadConfig.mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
    });
    mockCreateModel.mockReturnValue({ id: 'fake-model' });
    mockBuildSystemPrompt.mockReturnValue('You are an AI agent.');
    mockGetTools.mockReturnValue({ 'read-file': {}, 'write-file': {} });
    mockCreateToolRegistry.mockReturnValue({ getTools: mockGetTools });
    mockRunAgent.mockReturnValue(fakeAgentStream([{ type: 'done', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } }]));
  });

  // ── loadTasks ──────────────────────────────────────────────────────

  describe('loadTasks()', () => {
    it('loads all tasks from a JSON file', async () => {
      const runner = new SWEBenchRunner();
      const tasks = await runner.loadTasks('/path/to/tasks.json');

      expect(mockReadFile).toHaveBeenCalledWith('/path/to/tasks.json', 'utf-8');
      expect(tasks).toHaveLength(3);
      expect(tasks[0].instance_id).toBe('sample__test-1');
      expect(tasks[1].instance_id).toBe('sample__test-2');
      expect(tasks[2].instance_id).toBe('sample__test-3');
    });

    it('filters tasks by instance_id when filter is set', async () => {
      const runner = new SWEBenchRunner({ filter: ['sample__test-1', 'sample__test-3'] });
      const tasks = await runner.loadTasks('/path/to/tasks.json');

      expect(tasks).toHaveLength(2);
      expect(tasks[0].instance_id).toBe('sample__test-1');
      expect(tasks[1].instance_id).toBe('sample__test-3');
    });

    it('returns empty array when filter matches nothing', async () => {
      const runner = new SWEBenchRunner({ filter: ['nonexistent'] });
      const tasks = await runner.loadTasks('/path/to/tasks.json');

      expect(tasks).toHaveLength(0);
    });

    it('returns all tasks when filter is undefined', async () => {
      const runner = new SWEBenchRunner();
      const tasks = await runner.loadTasks('/path/to/tasks.json');

      expect(tasks).toHaveLength(3);
    });

    it('returns all tasks when filter is empty array', async () => {
      const runner = new SWEBenchRunner({ filter: [] });
      const tasks = await runner.loadTasks('/path/to/tasks.json');

      expect(tasks).toHaveLength(3);
    });
  });

  // ── buildPrompt ────────────────────────────────────────────────────

  describe('buildPrompt()', () => {
    it('includes the problem statement', () => {
      const runner = new SWEBenchRunner();
      const task = makeTask({ problem_statement: 'Bug: division by zero' });
      const prompt = runner.buildPrompt(task);

      expect(prompt).toContain('Bug: division by zero');
    });

    it('includes hints when provided', () => {
      const runner = new SWEBenchRunner();
      const task = makeTask({ hints_text: 'Check the denominator' });
      const prompt = runner.buildPrompt(task);

      expect(prompt).toContain('Hints:\nCheck the denominator');
    });

    it('does not include hints section when hints_text is undefined', () => {
      const runner = new SWEBenchRunner();
      const task = makeTask({ hints_text: undefined });
      const prompt = runner.buildPrompt(task);

      expect(prompt).not.toContain('Hints:');
    });

    it('includes instructions section', () => {
      const runner = new SWEBenchRunner();
      const task = makeTask();
      const prompt = runner.buildPrompt(task);

      expect(prompt).toContain('Instructions:');
      expect(prompt).toContain('Do NOT run tests');
    });
  });

  // ── generateReport ─────────────────────────────────────────────────

  describe('generateReport()', () => {
    it('calculates correct stats for mixed results', () => {
      const runner = new SWEBenchRunner();
      const results: SWEBenchResult[] = [
        { instance_id: 'a', resolved: true, patch: 'diff...', durationMs: 1000, steps: 5, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
        { instance_id: 'b', resolved: false, patch: '', error: 'Clone failed', durationMs: 500, steps: 0 },
        { instance_id: 'c', resolved: true, patch: 'diff2...', durationMs: 2000, steps: 10, usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
        { instance_id: 'd', resolved: false, patch: 'diff3...', durationMs: 1500, steps: 8, usage: { promptTokens: 150, completionTokens: 75, totalTokens: 225 } },
      ];

      const report = runner.generateReport(results);

      expect(report.total).toBe(4);
      expect(report.resolved).toBe(2);
      expect(report.errors).toBe(1);
      expect(report.failed).toBe(1); // 4 - 2 resolved - 1 error
      expect(report.resolveRate).toBe(0.5);
      expect(report.avgDurationMs).toBe(1250); // (1000+500+2000+1500)/4
      expect(report.avgSteps).toBe(6); // Math.round((5+0+10+8)/4) = Math.round(5.75) = 6
      expect(report.totalTokens).toBe(675); // 150+0+300+225
      expect(report.results).toBe(results);
    });

    it('handles empty results array', () => {
      const runner = new SWEBenchRunner();
      const report = runner.generateReport([]);

      expect(report.total).toBe(0);
      expect(report.resolved).toBe(0);
      expect(report.failed).toBe(0);
      expect(report.errors).toBe(0);
      expect(report.resolveRate).toBe(0);
      expect(report.avgDurationMs).toBe(0);
      expect(report.avgSteps).toBe(0);
      expect(report.totalTokens).toBe(0);
    });

    it('handles all resolved results', () => {
      const runner = new SWEBenchRunner();
      const results: SWEBenchResult[] = [
        { instance_id: 'a', resolved: true, patch: 'p1', durationMs: 1000, steps: 3, usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 } },
        { instance_id: 'b', resolved: true, patch: 'p2', durationMs: 2000, steps: 7, usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      ];

      const report = runner.generateReport(results);

      expect(report.resolveRate).toBe(1);
      expect(report.errors).toBe(0);
      expect(report.failed).toBe(0);
    });

    it('handles results without usage data', () => {
      const runner = new SWEBenchRunner();
      const results: SWEBenchResult[] = [
        { instance_id: 'a', resolved: false, patch: '', error: 'fail', durationMs: 100, steps: 0 },
      ];

      const report = runner.generateReport(results);

      expect(report.totalTokens).toBe(0);
    });
  });

  // ── runTask ────────────────────────────────────────────────────────

  describe('runTask()', () => {
    it('clones repo, checks out base commit, and runs agent', async () => {
      // Mock git diff to return a non-empty patch
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { stdout: 'diff --git a/math.py b/math.py\n-  return a - b\n+  return a + b', stderr: '', exitCode: 0 };
        }
        if (cmd === 'python') {
          return { stdout: 'passed', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      const runner = new SWEBenchRunner({ workDir: '/tmp/test' });
      const task = makeTask();

      const result = await runner.runTask(task);

      // Verify clone
      expect(mockExeca).toHaveBeenCalledWith('git', ['clone', '--depth=1', task.repo, expect.stringContaining('swe-bench-sample__test-1')]);
      // Verify fetch
      expect(mockExeca).toHaveBeenCalledWith('git', ['fetch', '--depth=1', 'origin', 'abc123'], expect.objectContaining({ cwd: expect.any(String) }));
      // Verify checkout
      expect(mockExeca).toHaveBeenCalledWith('git', ['checkout', 'abc123'], expect.objectContaining({ cwd: expect.any(String) }));
      // Verify agent was called
      expect(mockRunAgent).toHaveBeenCalled();
      // Result should be resolved (tests passed)
      expect(result.resolved).toBe(true);
      expect(result.patch).toContain('return a + b');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns resolved=false with error when no changes are made', async () => {
      // git diff returns empty patch
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { stdout: '', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      const runner = new SWEBenchRunner();
      const task = makeTask();

      const result = await runner.runTask(task);

      expect(result.resolved).toBe(false);
      expect(result.error).toBe('No changes made');
      expect(result.patch).toBe('');
    });

    it('returns resolved=false when tests fail', async () => {
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { stdout: 'diff --git ...', stderr: '', exitCode: 0 };
        }
        if (cmd === 'python') {
          return { stdout: '', stderr: 'FAILED', exitCode: 1 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      const runner = new SWEBenchRunner();
      const task = makeTask();

      const result = await runner.runTask(task);

      expect(result.resolved).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('catches errors during clone and returns error result', async () => {
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'clone') {
          throw new Error('Repository not found');
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      const runner = new SWEBenchRunner();
      const task = makeTask();

      const result = await runner.runTask(task);

      expect(result.resolved).toBe(false);
      expect(result.error).toBe('Repository not found');
      expect(result.instance_id).toBe('sample__test-1');
    });

    it('counts tool_call events as steps', async () => {
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { stdout: 'diff --git ...', stderr: '', exitCode: 0 };
        }
        if (cmd === 'python') {
          return { stdout: 'ok', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'tool_call', toolCallId: '1', toolName: 'read-file', args: {} },
        { type: 'tool_result', toolCallId: '1', toolName: 'read-file', result: 'content' },
        { type: 'tool_call', toolCallId: '2', toolName: 'write-file', args: {} },
        { type: 'tool_result', toolCallId: '2', toolName: 'write-file', result: 'ok' },
        { type: 'done', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      ]));

      const runner = new SWEBenchRunner();
      const task = makeTask();

      const result = await runner.runTask(task);

      expect(result.steps).toBe(2);
    });

    it('captures usage from done event', async () => {
      const expectedUsage = { promptTokens: 200, completionTokens: 80, totalTokens: 280 };
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          return { stdout: 'diff ...', stderr: '', exitCode: 0 };
        }
        if (cmd === 'python') {
          return { stdout: 'ok', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      mockRunAgent.mockReturnValue(fakeAgentStream([
        { type: 'done', usage: expectedUsage },
      ]));

      const runner = new SWEBenchRunner();
      const task = makeTask();

      const result = await runner.runTask(task);

      expect(result.usage).toEqual(expectedUsage);
    });

    it('uses default workDir /tmp when not specified', async () => {
      mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const runner = new SWEBenchRunner();
      const task = makeTask();

      await runner.runTask(task);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/^\/tmp\/swe-bench-/),
        { recursive: true },
      );
    });

    it('uses custom workDir when specified', async () => {
      mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const runner = new SWEBenchRunner({ workDir: '/custom/dir' });
      const task = makeTask();

      await runner.runTask(task);

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringMatching(/^\/custom\/dir\/swe-bench-/),
        { recursive: true },
      );
    });
  });

  // ── runAll ─────────────────────────────────────────────────────────

  describe('runAll()', () => {
    it('runs all tasks sequentially and returns a report', async () => {
      // Mock everything to produce predictable results
      let callCount = 0;
      mockExeca.mockImplementation(async (cmd: string, args: string[]) => {
        if (cmd === 'git' && args[0] === 'diff') {
          callCount++;
          // First task has a patch, second does not
          if (callCount <= 1) {
            return { stdout: 'diff --git ...', stderr: '', exitCode: 0 };
          }
          return { stdout: '', stderr: '', exitCode: 0 };
        }
        if (cmd === 'python') {
          return { stdout: 'ok', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: '', exitCode: 0 };
      });

      const tasks = [
        makeTask({ instance_id: 'task-a' }),
        makeTask({ instance_id: 'task-b' }),
      ];

      const runner = new SWEBenchRunner();
      const report = await runner.runAll(tasks);

      expect(report.total).toBe(2);
      expect(report.results).toHaveLength(2);
      expect(report.results[0].instance_id).toBe('task-a');
      expect(report.results[1].instance_id).toBe('task-b');
    });
  });

  // ── Options defaults ───────────────────────────────────────────────

  describe('options defaults', () => {
    it('uses default timeout of 600000ms', async () => {
      // Verify the timeout is passed via AbortController
      // We just verify the task runs without custom timeout
      mockExeca.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });

      const runner = new SWEBenchRunner();
      const task = makeTask();

      // Should not throw with default timeout
      const result = await runner.runTask(task);
      expect(result.instance_id).toBe('sample__test-1');
    });
  });
});
