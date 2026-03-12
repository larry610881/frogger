import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { detectTestFramework, buildTestCommand, parseTestOutput } from '../test-runner.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('detectTestFramework', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects vitest from vitest.config.ts', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('vitest.config.ts'),
    );
    expect(detectTestFramework('/project')).toBe('vitest');
  });

  it('detects jest from jest.config.js', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('jest.config.js'),
    );
    expect(detectTestFramework('/project')).toBe('jest');
  });

  it('detects jest from package.json jest field', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ jest: { preset: 'ts-jest' } }));
    expect(detectTestFramework('/project')).toBe('jest');
  });

  it('detects pytest from pytest.ini', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('pytest.ini'),
    );
    expect(detectTestFramework('/project')).toBe('pytest');
  });

  it('detects pytest from pyproject.toml with [tool.pytest]', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('pyproject.toml'),
    );
    vi.mocked(readFileSync).mockReturnValue('[tool.pytest.ini_options]\naddopts = "-v"');
    expect(detectTestFramework('/project')).toBe('pytest');
  });

  it('detects cargo from Cargo.toml', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('Cargo.toml'),
    );
    expect(detectTestFramework('/project')).toBe('cargo');
  });

  it('detects go from go.mod', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('go.mod'),
    );
    expect(detectTestFramework('/project')).toBe('go');
  });

  it('falls back to npm-script when package.json has test script', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ scripts: { test: 'mocha' } }));
    expect(detectTestFramework('/project')).toBe('npm-script');
  });

  it('ignores default npm test script placeholder', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    );
    expect(detectTestFramework('/project')).toBeNull();
  });

  it('returns null when no framework detected', () => {
    expect(detectTestFramework('/project')).toBeNull();
  });

  it('prioritizes vitest over jest', () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.endsWith('vitest.config.ts') || s.endsWith('jest.config.js');
    });
    expect(detectTestFramework('/project')).toBe('vitest');
  });
});

describe('buildTestCommand', () => {
  it('builds vitest command with JSON reporter', () => {
    const { cmd, args } = buildTestCommand('vitest');
    expect(cmd).toBe('npx');
    expect(args).toEqual(['vitest', 'run', '--reporter=json']);
  });

  it('builds vitest command with filter', () => {
    const { cmd, args } = buildTestCommand('vitest', 'my-test.ts');
    expect(cmd).toBe('npx');
    expect(args).toEqual(['vitest', 'run', '--reporter=json', 'my-test.ts']);
  });

  it('builds jest command with JSON output', () => {
    const { cmd, args } = buildTestCommand('jest');
    expect(cmd).toBe('npx');
    expect(args).toEqual(['jest', '--json']);
  });

  it('builds jest command with filter', () => {
    const { cmd, args } = buildTestCommand('jest', 'auth');
    expect(cmd).toBe('npx');
    expect(args).toEqual(['jest', '--json', '--testPathPattern', 'auth']);
  });

  it('builds pytest command', () => {
    const { cmd, args } = buildTestCommand('pytest');
    expect(cmd).toBe('python');
    expect(args).toEqual(['-m', 'pytest', '-v']);
  });

  it('builds pytest command with filter', () => {
    const { cmd, args } = buildTestCommand('pytest', 'test_auth');
    expect(cmd).toBe('python');
    expect(args).toEqual(['-m', 'pytest', '-v', '-k', 'test_auth']);
  });

  it('builds cargo test command', () => {
    const { cmd, args } = buildTestCommand('cargo');
    expect(cmd).toBe('cargo');
    expect(args).toEqual(['test']);
  });

  it('builds go test command', () => {
    const { cmd, args } = buildTestCommand('go');
    expect(cmd).toBe('go');
    expect(args).toEqual(['test', '-v', './...']);
  });

  it('builds npm-script command', () => {
    const { cmd, args } = buildTestCommand('npm-script');
    expect(cmd).toBe('npm');
    expect(args).toEqual(['test', '--']);
  });
});

describe('parseTestOutput', () => {
  it('parses vitest/jest JSON output', () => {
    const json = JSON.stringify({
      numPassedTests: 10,
      numFailedTests: 2,
      numPendingTests: 1,
      testResults: [
        {
          startTime: 1000,
          endTime: 3000,
          assertionResults: [
            { status: 'passed', fullName: 'test 1' },
            {
              status: 'failed',
              fullName: 'test 2',
              failureMessages: ['Expected true to be false'],
            },
          ],
        },
      ],
    });

    const result = parseTestOutput('vitest', json, '', 1, 'npx vitest run');
    expect(result.passed).toBe(10);
    expect(result.failed).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].name).toBe('test 2');
    expect(result.failures[0].error).toContain('Expected true to be false');
  });

  it('falls back to text parsing when JSON is not available', () => {
    const output = `
      Tests:  15 passed, 3 failed, 1 skipped
      Duration: 4.2s
    `;
    const result = parseTestOutput('vitest', output, '', 1, 'npx vitest run');
    expect(result.passed).toBe(15);
    expect(result.failed).toBe(3);
    expect(result.skipped).toBe(1);
  });

  it('infers pass from exit code 0 when no counts found', () => {
    const result = parseTestOutput('cargo', 'test result: ok.', '', 0, 'cargo test');
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('infers failure from non-zero exit code when no counts found', () => {
    const result = parseTestOutput('cargo', 'compilation error', '', 1, 'cargo test');
    expect(result.passed).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('extracts FAIL lines as failure details', () => {
    const output = 'FAIL src/auth.test.ts\nTypeError: undefined is not a function\n  at line 42';
    const result = parseTestOutput('jest', '', output, 1, 'npx jest');
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0].name).toContain('FAIL');
  });
});
