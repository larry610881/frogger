import { tool } from 'ai';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { ToolMetadata } from '@frogger/shared';
import { truncateOutput } from './output-utils.js';
import { assertWithinBoundary } from './security.js';

const SAFE_INCLUDE_PATTERN = /^[a-zA-Z0-9.*?\[\]{},_\-\/\\]+$/;

const execFileAsync = promisify(execFile);

export const grepMetadata: ToolMetadata = {
  name: 'grep',
  description:
    'Search file contents using regex pattern (supports case-insensitive, context lines, files-only mode)',
  permissionLevel: 'auto',
  category: 'search',
  hints: 'Prefer over reading multiple files. Use include glob to narrow scope.',
};

export function createGrepTool(workingDirectory: string) {
  return tool({
    description: grepMetadata.description,
    inputSchema: z.object({
      pattern: z.string().describe('Search pattern (regex)'),
      path: z.string().optional().describe('Directory to search'),
      include: z.string().optional().describe('File glob filter'),
      ignoreCase: z
        .boolean()
        .optional()
        .describe('Case-insensitive search'),
      contextLines: z
        .number()
        .optional()
        .describe('Number of context lines around matches (-C)'),
      filesOnly: z
        .boolean()
        .optional()
        .describe('Only return file paths with matches (-l)'),
    }),
    execute: async ({
      pattern,
      path: searchPath,
      include,
      ignoreCase,
      contextLines,
      filesOnly,
    }) => {
      try {
        if (searchPath) {
          assertWithinBoundary(searchPath, workingDirectory);
        }
        const searchDir = searchPath
          ? path.resolve(workingDirectory, searchPath)
          : workingDirectory;

        const baseFlag = filesOnly ? '-rl' : '-rn';
        const args = [baseFlag, '--color=never'];
        if (ignoreCase) {
          args.push('-i');
        }
        if (contextLines != null && !filesOnly) {
          args.push(`-C`, String(contextLines));
        }
        if (include) {
          if (!SAFE_INCLUDE_PATTERN.test(include)) {
            return `Error: Invalid include pattern "${include}" — contains unsafe characters`;
          }
          args.push(`--include=${include}`);
        }
        args.push(pattern, searchDir);

        const { stdout } = await execFileAsync('grep', args, {
          maxBuffer: 1024 * 1024,
        });
        return truncateOutput(stdout) || 'No matches found';
      } catch (err: unknown) {
        // grep exits with code 1 when no matches found
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          err.code === 1
        ) {
          return 'No matches found';
        }
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
