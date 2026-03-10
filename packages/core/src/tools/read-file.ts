import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertWithinBoundary } from './security.js';
import type { ToolMetadata } from '@frogger/shared';

export const readFileMetadata: ToolMetadata = {
  name: 'read-file',
  description:
    'Read the contents of a file. Supports optional offset (0-based line number) and limit (max lines) to read a specific range.',
  permissionLevel: 'auto',
};

export function createReadFileTool(workingDirectory: string) {
  return tool({
    description: readFileMetadata.description,
    inputSchema: z.object({
      path: z.string().describe('Absolute or relative file path'),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('0-based line number to start reading from'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Maximum number of lines to return'),
    }),
    execute: async ({ path: filePath, offset, limit }) => {
      try {
        assertWithinBoundary(filePath, workingDirectory);
        const resolved = path.resolve(workingDirectory, filePath);
        const content = await fs.readFile(resolved, 'utf-8');

        if (offset === undefined && limit === undefined) {
          return content;
        }

        const allLines = content.split('\n');
        const total = allLines.length;
        const start = offset ?? 0;

        if (start >= total) {
          return `Error: offset ${start} is beyond the end of the file (${total} lines)`;
        }

        const sliced = limit !== undefined
          ? allLines.slice(start, start + limit)
          : allLines.slice(start);

        const endLineIndex = start + sliced.length - 1;
        const header = `Lines ${start + 1}-${endLineIndex + 1} of ${total}:`;
        const numbered = sliced.map(
          (line, i) => `  ${start + i + 1}\t${line}`,
        );

        return `${header}\n${numbered.join('\n')}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
