import { tool } from 'ai';
import { z } from 'zod';
import { globby } from 'globby';
import path from 'node:path';
import type { ToolMetadata } from '@frogger/shared';

export const globMetadata: ToolMetadata = {
  name: 'glob',
  description: 'Search for files matching a glob pattern',
  permissionLevel: 'auto',
};

export function createGlobTool(workingDirectory: string) {
  return tool({
    description: globMetadata.description,
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    execute: async ({ pattern, cwd }) => {
      try {
        const searchDir = cwd
          ? path.resolve(workingDirectory, cwd)
          : workingDirectory;
        const files = await globby(pattern, { cwd: searchDir });
        return JSON.stringify(files, null, 2);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
