import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import path from 'node:path';
import type { ToolMetadata } from '@frogger/shared';
import { assertWithinBoundary } from './security.js';
import { truncateOutput } from './output-utils.js';

export const bashMetadata: ToolMetadata = {
  name: 'bash',
  description: 'Execute a shell command',
  permissionLevel: 'confirm',
};

const BLOCKED_PATTERNS = [
  /rm\s+-[^\s]*r[^\s]*f[^\s]*\s+\//,     // rm -rf /
  /rm\s+-[^\s]*f[^\s]*r[^\s]*\s+\//,     // rm -fr /
  /mkfs\./,                                // mkfs.ext4 etc.
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,       // fork bomb
  /dd\s+.*of=\/dev\//,                    // dd to device
  />\s*\/dev\/sd/,                         // redirect to device
  /curl\s.*\|\s*sh/,                       // curl pipe to sh
  /wget\s.*\|\s*sh/,                       // wget pipe to sh
  /curl\s.*\|\s*bash/,                     // curl pipe to bash
  /wget\s.*\|\s*bash/,                     // wget pipe to bash
  /chmod\s+-R\s+777\s+\//,                // chmod -R 777 /
  /chown\s+-R\s+.*\s+\//,                 // chown -R on root
];

export function isCommandBlocked(command: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(command));
}

export function createBashTool(workingDirectory: string) {
  return tool({
    description: bashMetadata.description,
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute'),
      cwd: z.string().optional().describe('Working directory'),
      timeout: z
        .number()
        .int()
        .min(1)
        .max(600_000)
        .optional()
        .describe(
          'Timeout in milliseconds (default: 30000, max: 600000 i.e. 10 minutes)',
        ),
    }),
    execute: async ({ command, cwd, timeout }) => {
      try {
        if (isCommandBlocked(command)) {
          return 'Error: Command blocked for safety reasons';
        }

        const execCwd = cwd
          ? path.resolve(workingDirectory, cwd)
          : workingDirectory;
        if (cwd) {
          assertWithinBoundary(execCwd, workingDirectory);
        }

        const execTimeout = timeout ?? 30_000;
        const result = await execa({
          shell: true,
          cwd: execCwd,
          timeout: execTimeout,
          forceKillAfterDelay: 1000,
          reject: false,
        })`${command}`;

        if (result.timedOut) {
          const output = [result.stdout, result.stderr]
            .filter(Boolean)
            .join('\n');
          return `Error: Command timed out after ${execTimeout}ms${output ? `\n${output}` : ''}`;
        }

        const output = [result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n');

        if (result.exitCode !== 0) {
          return truncateOutput(`Exit code ${result.exitCode}\n${output}`);
        }

        return truncateOutput(output) || '(no output)';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
