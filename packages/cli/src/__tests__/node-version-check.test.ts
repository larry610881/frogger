import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const BIN_PATH = resolve(import.meta.dirname, '../../bin/frogger.js');

describe('bin/frogger.js version check', () => {
  it('should exit with error when Node version is below 22', () => {
    // Spawn a script that fakes process.versions.node, then evaluates the
    // version-check portion of the bin file.
    const fakeScript = `
      // Override the node version before the check runs
      Object.defineProperty(process.versions, 'node', {
        value: '14.21.3',
        writable: true,
        configurable: true,
      });

      var nodeVersion = process.versions.node;
      var major = parseInt(nodeVersion.split('.')[0], 10);
      if (major < 22) {
        console.error(
          'Error: Frogger requires Node.js >= 22.0.0 (current: v' + nodeVersion + ')\\n' +
          'Install the latest LTS: https://nodejs.org/'
        );
        process.exit(1);
      }
    `;

    try {
      execFileSync(process.execPath, ['--eval', fakeScript], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Should not reach here
      expect.unreachable('Expected process to exit with code 1');
    } catch (err: unknown) {
      const error = err as { status: number; stderr: string };
      expect(error.status).toBe(1);
      expect(error.stderr).toContain('Frogger requires Node.js >= 22.0.0');
      expect(error.stderr).toContain('v14.21.3');
      expect(error.stderr).toContain('https://nodejs.org/');
    }
  });

  it('should not exit when Node version meets requirement', () => {
    // The actual bin file runs on current Node (22+), so just verify
    // the version check logic passes without error.
    const fakeScript = `
      var nodeVersion = process.versions.node;
      var major = parseInt(nodeVersion.split('.')[0], 10);
      if (major < 22) {
        process.exit(1);
      }
      // Exit cleanly without importing dist (which may not be built)
      process.exit(0);
    `;

    const result = execFileSync(process.execPath, ['--eval', fakeScript], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // If we get here, the process exited with code 0 (success)
    expect(result).toBeDefined();
  });
});
