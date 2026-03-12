import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR, MAX_MEMORY_SIZE } from '@frogger/shared';
import type { ToolMetadata } from '@frogger/shared';

export const saveMemoryMetadata: ToolMetadata = {
  name: 'save-memory',
  description: 'Save a memory note to persistent storage. Use this to remember important context across sessions.',
  permissionLevel: 'confirm',
};

export function createSaveMemoryTool() {
  return tool({
    description: saveMemoryMetadata.description,
    inputSchema: z.object({
      content: z.string().describe('The memory content to save (markdown format)'),
    }),
    execute: async ({ content }) => {
      const memoryDir = path.join(homedir(), CONFIG_DIR, 'memory');
      const memoryFile = path.join(memoryDir, 'MEMORY.md');
      fs.mkdirSync(memoryDir, { recursive: true });

      const entry = `\n\n---\n\n_Saved: ${new Date().toISOString().split('T')[0]}_\n\n${content.trim()}`;

      if (!fs.existsSync(memoryFile)) {
        fs.writeFileSync(memoryFile, `# Frogger Memory\n${entry}`, 'utf-8');
        return `Memory saved to ${memoryFile}`;
      }

      const existing = fs.readFileSync(memoryFile, 'utf-8');
      const combined = existing + entry;

      if (combined.length <= MAX_MEMORY_SIZE) {
        fs.writeFileSync(memoryFile, combined, 'utf-8');
        return `Memory saved to ${memoryFile}`;
      }

      // Truncate oldest entries to fit within limit
      const ENTRY_SEPARATOR = '\n\n---\n\n';
      const parts = existing.split(ENTRY_SEPARATOR);
      const header = parts[0]; // "# Frogger Memory" or similar
      const entries = parts.slice(1); // oldest first

      // Remove oldest entries until new content fits
      let truncated = 0;
      while (entries.length > 0) {
        const rebuilt = header + ENTRY_SEPARATOR + entries.join(ENTRY_SEPARATOR) + entry;
        if (rebuilt.length <= MAX_MEMORY_SIZE) {
          break;
        }
        entries.shift();
        truncated++;
      }

      const final = entries.length > 0
        ? header + ENTRY_SEPARATOR + entries.join(ENTRY_SEPARATOR) + entry
        : header + entry;
      fs.writeFileSync(memoryFile, final, 'utf-8');
      return `Memory saved to ${memoryFile} (truncated ${truncated} oldest ${truncated === 1 ? 'entry' : 'entries'} to stay within ${MAX_MEMORY_SIZE} byte limit)`;
    },
  });
}
