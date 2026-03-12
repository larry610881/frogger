import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { ToolMetadata } from '@frogger/shared';
import { truncateOutput } from './output-utils.js';

export const testRunnerMetadata: ToolMetadata = {
  name: 'test-runner',
  description: 'Auto-detect and run project tests, returning structured results',
  permissionLevel: 'auto',
};

export type TestFramework = 'vitest' | 'jest' | 'pytest' | 'cargo' | 'go' | 'npm-script';

export interface TestResult {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failures: { name: string; error: string }[];
  command: string;
}

/**
 * Detect test framework by scanning config files and package.json.
 * Returns framework name in priority order.
 */
export function detectTestFramework(cwd: string): TestFramework | null {
  // 1. vitest
  if (
    existsSync(path.join(cwd, 'vitest.config.ts')) ||
    existsSync(path.join(cwd, 'vitest.config.js')) ||
    existsSync(path.join(cwd, 'vitest.config.mts'))
  ) {
    return 'vitest';
  }

  // 2. jest
  if (
    existsSync(path.join(cwd, 'jest.config.ts')) ||
    existsSync(path.join(cwd, 'jest.config.js')) ||
    existsSync(path.join(cwd, 'jest.config.mjs'))
  ) {
    return 'jest';
  }

  // Check package.json for jest config
  const pkgPath = path.join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.jest) return 'jest';
    } catch { /* ignore */ }
  }

  // 3. pytest
  if (
    existsSync(path.join(cwd, 'pytest.ini')) ||
    existsSync(path.join(cwd, 'setup.cfg'))
  ) {
    return 'pytest';
  }
  if (existsSync(path.join(cwd, 'pyproject.toml'))) {
    try {
      const content = readFileSync(path.join(cwd, 'pyproject.toml'), 'utf-8');
      if (content.includes('[tool.pytest')) return 'pytest';
    } catch { /* ignore */ }
  }

  // 4. cargo
  if (existsSync(path.join(cwd, 'Cargo.toml'))) return 'cargo';

  // 5. go
  if (existsSync(path.join(cwd, 'go.mod'))) return 'go';

  // 6. Fallback: package.json scripts.test
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        return 'npm-script';
      }
    } catch { /* ignore */ }
  }

  return null;
}

/**
 * Build the command + args for a given framework.
 */
export function buildTestCommand(
  framework: TestFramework,
  filter?: string,
): { cmd: string; args: string[] } {
  switch (framework) {
    case 'vitest':
      return {
        cmd: 'npx',
        args: ['vitest', 'run', '--reporter=json', ...(filter ? [filter] : [])],
      };
    case 'jest':
      return {
        cmd: 'npx',
        args: ['jest', '--json', ...(filter ? ['--testPathPattern', filter] : [])],
      };
    case 'pytest':
      return {
        cmd: 'python',
        args: ['-m', 'pytest', '-v', ...(filter ? ['-k', filter] : [])],
      };
    case 'cargo':
      return {
        cmd: 'cargo',
        args: ['test', ...(filter ? ['--', filter] : [])],
      };
    case 'go':
      return {
        cmd: 'go',
        args: ['test', '-v', ...(filter ? ['-run', filter] : ['./...'])],
      };
    case 'npm-script':
      return {
        cmd: 'npm',
        args: ['test', '--', ...(filter ? [filter] : [])],
      };
  }
}

/**
 * Parse test output into a structured TestResult.
 */
export function parseTestOutput(
  framework: TestFramework,
  stdout: string,
  stderr: string,
  exitCode: number,
  command: string,
): TestResult {
  const result: TestResult = {
    framework,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: '',
    failures: [],
    command,
  };

  const output = `${stdout}\n${stderr}`;

  if (framework === 'vitest' || framework === 'jest') {
    // Try parsing JSON output
    try {
      // vitest/jest JSON output may be mixed with other text, find the JSON block
      const jsonMatch = stdout.match(/(\{[\s\S]*"testResults"[\s\S]*\})/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1]);
        result.passed = json.numPassedTests ?? 0;
        result.failed = json.numFailedTests ?? 0;
        result.skipped = (json.numPendingTests ?? 0) + (json.numTodoTests ?? 0);

        // Extract failures
        if (json.testResults) {
          for (const suite of json.testResults) {
            for (const test of suite.assertionResults ?? []) {
              if (test.status === 'failed') {
                result.failures.push({
                  name: test.fullName ?? test.title ?? 'unknown',
                  error: (test.failureMessages ?? []).join('\n').slice(0, 500),
                });
              }
            }
          }
        }

        // Duration
        const durationMs = json.testResults?.reduce(
          (sum: number, r: { endTime?: number; startTime?: number }) =>
            sum + ((r.endTime ?? 0) - (r.startTime ?? 0)),
          0,
        ) ?? 0;
        result.duration = `${(durationMs / 1000).toFixed(1)}s`;
        return result;
      }
    } catch { /* fall through to text parsing */ }
  }

  // Text-based fallback parsing
  // Look for common patterns: "X passed", "X failed", "X skipped"
  const passedMatch = output.match(/(\d+)\s+(?:passed|passing)/i);
  const failedMatch = output.match(/(\d+)\s+(?:failed|failing)/i);
  const skippedMatch = output.match(/(\d+)\s+(?:skipped|pending)/i);
  const durationMatch = output.match(/(?:Time|Duration|Finished in)[:\s]+([^\n]+)/i);

  if (passedMatch) result.passed = parseInt(passedMatch[1], 10);
  if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
  if (skippedMatch) result.skipped = parseInt(skippedMatch[1], 10);
  if (durationMatch) result.duration = durationMatch[1].trim();

  // If no numbers found, infer from exit code
  if (result.passed === 0 && result.failed === 0) {
    if (exitCode === 0) {
      result.passed = 1; // At least tests passed
    } else {
      result.failed = 1; // At least tests failed
    }
  }

  // Extract failure messages from text output
  if (exitCode !== 0 && result.failures.length === 0) {
    // Look for FAIL patterns
    const failLines = output.match(/(?:FAIL|FAILED|Error)[^\n]*\n(?:[^\n]*\n){0,3}/g);
    if (failLines) {
      for (const block of failLines.slice(0, 10)) {
        result.failures.push({
          name: block.split('\n')[0].trim(),
          error: block.trim().slice(0, 500),
        });
      }
    }
  }

  return result;
}

export function createTestRunnerTool(workingDirectory: string) {
  return tool({
    description: testRunnerMetadata.description,
    inputSchema: z.object({
      filter: z.string().optional().describe('Test file or test name filter'),
      framework: z
        .enum(['vitest', 'jest', 'pytest', 'cargo', 'go'])
        .optional()
        .describe('Override auto-detection'),
      timeout: z
        .number()
        .int()
        .min(1000)
        .max(600_000)
        .optional()
        .describe('Timeout in ms (default: 60000)'),
    }),
    execute: async ({ filter, framework: overrideFramework, timeout }) => {
      try {
        const detected = overrideFramework ?? detectTestFramework(workingDirectory);
        if (!detected) {
          return 'No test framework detected. Looked for: vitest, jest, pytest, cargo, go, npm test script.';
        }

        const { cmd, args } = buildTestCommand(detected, filter);
        const execTimeout = timeout ?? 60_000;
        const commandStr = `${cmd} ${args.join(' ')}`;

        const result = await execa(cmd, args, {
          cwd: workingDirectory,
          timeout: execTimeout,
          forceKillAfterDelay: 1000,
          reject: false,
        });

        if (result.timedOut) {
          return JSON.stringify({
            framework: detected,
            error: `Test execution timed out after ${execTimeout}ms`,
            command: commandStr,
            partialOutput: truncateOutput(`${result.stdout}\n${result.stderr}`, 5000),
          });
        }

        const parsed = parseTestOutput(
          detected,
          result.stdout,
          result.stderr,
          result.exitCode ?? 0,
          commandStr,
        );

        // Add raw output for context if tests failed
        if (parsed.failed > 0) {
          const rawOutput = truncateOutput(`${result.stdout}\n${result.stderr}`, 10000);
          return JSON.stringify(parsed) + '\n\nRaw output:\n' + rawOutput;
        }

        return JSON.stringify(parsed);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error running tests: ${message}`;
      }
    },
  });
}
