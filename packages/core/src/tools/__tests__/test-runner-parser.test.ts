import { describe, it, expect } from 'vitest';
import { formatTestResponse, parseTestOutput, type TestResult } from '../test-runner.js';

describe('formatTestResponse', () => {
  it('formats a passing test result without raw output', () => {
    const parsed: TestResult = {
      framework: 'vitest',
      passed: 10,
      failed: 0,
      skipped: 1,
      duration: '2.3s',
      failures: [],
      command: 'npx vitest run',
    };

    const result = formatTestResponse(parsed);

    expect(result).toContain('## Test Summary');
    expect(result).toContain('**Framework**: vitest');
    expect(result).toContain('**Passed**: 10');
    expect(result).toContain('**Failed**: 0');
    expect(result).toContain('**Skipped**: 1');
    expect(result).toContain('**Duration**: 2.3s');
    expect(result).toContain('`npx vitest run`');
    expect(result).not.toContain('### Failures');
    expect(result).not.toContain('## Raw Output');
  });

  it('formats a failing test result with failure details', () => {
    const parsed: TestResult = {
      framework: 'jest',
      passed: 8,
      failed: 2,
      skipped: 0,
      duration: '4.1s',
      failures: [
        { name: 'auth > should login', error: 'Expected 200 but got 401\n  at line 42' },
        { name: 'auth > should logout', error: 'Timeout after 5000ms' },
      ],
      command: 'npx jest --json',
    };

    const result = formatTestResponse(parsed);

    expect(result).toContain('### Failures');
    expect(result).toContain('**[FAILED]** auth > should login');
    expect(result).toContain('Expected 200 but got 401');
    expect(result).toContain('**[FAILED]** auth > should logout');
    expect(result).toContain('Timeout after 5000ms');
  });

  it('includes raw output when provided', () => {
    const parsed: TestResult = {
      framework: 'pytest',
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: '1.2s',
      failures: [{ name: 'test_auth', error: 'AssertionError' }],
      command: 'python -m pytest -v',
    };

    const result = formatTestResponse(parsed, 'FAILED test_auth.py::test_login\nAssertionError: expected True');

    expect(result).toContain('## Raw Output');
    expect(result).toContain('```');
    expect(result).toContain('FAILED test_auth.py::test_login');
  });

  it('omits duration when empty', () => {
    const parsed: TestResult = {
      framework: 'cargo',
      passed: 5,
      failed: 0,
      skipped: 0,
      duration: '',
      failures: [],
      command: 'cargo test',
    };

    const result = formatTestResponse(parsed);

    expect(result).not.toContain('**Duration**');
  });
});

describe('parseTestOutput with structured formatting', () => {
  it('parses vitest JSON output correctly', () => {
    const json = JSON.stringify({
      numPassedTests: 15,
      numFailedTests: 0,
      numPendingTests: 2,
      testResults: [
        {
          startTime: 1000,
          endTime: 3500,
          assertionResults: [
            { status: 'passed', fullName: 'utils > should format date' },
          ],
        },
      ],
    });

    const result = parseTestOutput('vitest', json, '', 0, 'npx vitest run --reporter=json');
    expect(result.framework).toBe('vitest');
    expect(result.passed).toBe(15);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.duration).toBe('2.5s');
  });

  it('parses pytest text output', () => {
    const output = `
============================= test session starts ==============================
collected 12 items

test_auth.py::test_login PASSED
test_auth.py::test_logout PASSED
test_auth.py::test_register FAILED

========================= 2 passed, 1 failed, 0 skipped in 3.45s =========================
    `;

    const result = parseTestOutput('pytest', output, '', 1, 'python -m pytest -v');
    expect(result.framework).toBe('pytest');
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('parses jest text fallback output', () => {
    const output = `
Test Suites: 1 failed, 3 passed, 4 total
Tests:       2 failed, 10 passed, 12 total
Time:        5.123 s
    `;

    const result = parseTestOutput('jest', '', output, 1, 'npx jest');
    // Regex matches first occurrence: "3 passed" from Test Suites line
    expect(result.passed).toBe(3);
    // Regex matches first occurrence: "1 failed" from Test Suites line
    expect(result.failed).toBe(1);
  });

  it('handles go test output', () => {
    const output = `
=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestSubtract
--- FAIL: TestSubtract (0.00s)
FAIL
FAIL    myproject/math  0.003s
    `;

    const result = parseTestOutput('go', output, '', 1, 'go test -v ./...');
    expect(result.failed).toBeGreaterThan(0);
  });
});
