import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertWithinBoundary } from './security.js';
import { generateUnifiedDiff } from './diff-utils.js';
import type { ToolMetadata } from '@frogger/shared';

export const writeFileMetadata: ToolMetadata = {
  name: 'write-file',
  description: 'Create or overwrite a file',
  permissionLevel: 'confirm',
};

export function createWriteFileTool(workingDirectory: string) {
  return tool({
    description: writeFileMetadata.description,
    inputSchema: z.object({
      path: z.string().describe('File path'),
      content: z.string().describe('File content'),
    }),
    execute: async ({ path: filePath, content }) => {
      try {
        assertWithinBoundary(filePath, workingDirectory);
        const resolved = path.resolve(workingDirectory, filePath);
        await fs.mkdir(path.dirname(resolved), { recursive: true });

        // Read old content for diff (if file exists)
        let oldContent = '';
        try {
          oldContent = await fs.readFile(resolved, 'utf-8');
        } catch {
          // New file — no old content
        }

        await fs.writeFile(resolved, content, 'utf-8');

        const diff = generateUnifiedDiff(filePath, oldContent, content);
        if (diff) {
          return `File written: ${filePath}\n\n\`\`\`diff\n${diff}\n\`\`\``;
        }
        return `File written: ${filePath}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
