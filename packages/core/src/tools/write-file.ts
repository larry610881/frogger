import { tool } from 'ai';
import { z } from 'zod';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertWithinBoundary } from './security.js';
import { generateUnifiedDiff } from './diff-utils.js';
import type { ToolMetadata } from '@frogger/shared';

export const writeFileMetadata: ToolMetadata = {
  name: 'write-file',
  description: 'Create or overwrite a file',
  permissionLevel: 'confirm',
  category: 'write',
  hints: 'Prefer edit-file for existing files. Use write-file only for new files.',
};

export function createWriteFileTool(workingDirectory: string) {
  return tool({
    description: writeFileMetadata.description,
    inputSchema: z.object({
      path: z.string().describe('File path'),
      content: z.string().describe('File content'),
    }),
    execute: async ({ path: filePath, content }) => {
      let tmpPath: string | undefined;
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

        tmpPath = `${resolved}.frogger-tmp-${crypto.randomBytes(4).toString('hex')}`;
        await fs.writeFile(tmpPath, content, 'utf-8');
        await fs.rename(tmpPath, resolved);

        const diff = generateUnifiedDiff(filePath, oldContent, content);
        if (diff) {
          return `File written: ${filePath}\n\n\`\`\`diff\n${diff}\n\`\`\``;
        }
        return `File written: ${filePath}`;
      } catch (err) {
        if (tmpPath) {
          try { await fs.unlink(tmpPath); } catch { /* already cleaned up */ }
        }
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
