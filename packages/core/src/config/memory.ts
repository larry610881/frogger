import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { CONFIG_DIR } from '@frogger/shared';

export function loadMemory(): string | undefined {
  const memoryFile = path.join(homedir(), CONFIG_DIR, 'memory', 'MEMORY.md');
  if (!fs.existsSync(memoryFile)) return undefined;
  const content = fs.readFileSync(memoryFile, 'utf-8').trim();
  return content || undefined;
}
