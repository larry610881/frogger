import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { assertWithinBoundary } from './security.js';
import type { ToolMetadata } from '@frogger/shared';

export const listFilesMetadata: ToolMetadata = {
  name: 'list-files',
  description: 'List files and directories',
  permissionLevel: 'auto',
  category: 'search',
  hints: 'List directory contents. Use glob for pattern matching.',
};

export function createListFilesTool(workingDirectory: string) {
  return tool({
    description: listFilesMetadata.description,
    inputSchema: z.object({
      path: z.string().optional().describe('Directory path'),
      recursive: z.boolean().optional().describe('List recursively'),
    }),
    execute: async ({ path: dirPath, recursive }) => {
      try {
        const resolved = dirPath
          ? nodePath.resolve(workingDirectory, dirPath)
          : workingDirectory;

        if (dirPath) {
          assertWithinBoundary(dirPath, workingDirectory);
        }

        const entries = await fs.readdir(resolved, {
          withFileTypes: true,
          recursive: recursive ?? false,
        });

        const lines = entries.map((entry) => {
          const prefix = entry.isDirectory() ? '[DIR]  ' : '[FILE] ';
          const rel = entry.parentPath
            ? nodePath.relative(resolved, nodePath.join(entry.parentPath, entry.name))
            : entry.name;
          return `${prefix}${rel}`;
        });

        return lines.join('\n') || '(empty directory)';
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
