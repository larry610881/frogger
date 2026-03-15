import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import DiffMatchPatch from 'diff-match-patch';
import { assertWithinBoundary } from './security.js';
import { generateUnifiedDiff } from './diff-utils.js';
import type { ToolMetadata } from '@frogger/shared';

export const editFileMetadata: ToolMetadata = {
  name: 'edit-file',
  description: 'Edit a file using search and replace',
  permissionLevel: 'confirm',
  category: 'write',
  hints: 'old_text must be unique. Re-read file if match fails.',
};

export function createEditFileTool(workingDirectory: string) {
  return tool({
    description: editFileMetadata.description,
    inputSchema: z.object({
      path: z.string().describe('File path'),
      old_text: z.string().describe('Text to find'),
      new_text: z.string().describe('Replacement text'),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          'Replace all occurrences instead of requiring unique match',
        ),
    }),
    execute: async ({ path: filePath, old_text, new_text, replace_all }) => {
      try {
        assertWithinBoundary(filePath, workingDirectory);
        const resolved = path.resolve(workingDirectory, filePath);
        const content = await fs.readFile(resolved, 'utf-8');

        // Try exact match first
        if (content.includes(old_text)) {
          const count = content.split(old_text).length - 1;
          if (count > 1 && !replace_all) {
            return `Error: Found ${count} matches for old_text. Please provide more context to make the match unique.`;
          }
          const updated =
            replace_all && count > 1
              ? content.split(old_text).join(new_text)
              : content.replace(old_text, new_text);
          await fs.writeFile(resolved, updated, 'utf-8');
          const diff = generateUnifiedDiff(filePath, content, updated);
          const label =
            replace_all && count > 1
              ? `${count} replacements`
              : 'exact match';
          return `File edited: ${filePath} (${label})\n\n\`\`\`diff\n${diff}\n\`\`\``;
        }

        // Fuzzy fallback with diff-match-patch
        const dmp = new DiffMatchPatch();
        const patches = dmp.patch_make(old_text, new_text);
        const [patched, results] = dmp.patch_apply(patches, content);

        if (results.some((r) => r)) {
          await fs.writeFile(resolved, patched, 'utf-8');
          const diff = generateUnifiedDiff(filePath, content, patched);
          return `File edited: ${filePath} (fuzzy match)\n\n\`\`\`diff\n${diff}\n\`\`\``;
        }

        return `Error: Could not find a match for old_text in ${filePath}\nHint: Re-read the file to see current content, then retry with exact match.`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
