import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { CONFIG_DIR, MAX_RULES_SIZE } from '@frogger/shared';
import { logger } from '../utils/logger.js';

interface RuleFile {
  name: string;
  content: string;
}

/** Cache for memoized rules loading */
let rulesCache: { hash: string; content: string | undefined } | null = null;

/**
 * Read all `.md` files from a directory, sorted alphabetically by filename.
 * Returns empty array if directory doesn't exist or is unreadable.
 */
function loadMdFiles(dir: string): RuleFile[] {
  if (!fs.existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(filename => ({
      name: filename,
      content: fs.readFileSync(path.join(dir, filename), 'utf-8'),
    }));
}

/**
 * Compute a hash of the file set (paths + sizes + mtimes) for cache invalidation.
 */
function computeFileSetHash(dirs: string[]): string {
  const hash = createHash('sha256');
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
      for (const entry of entries) {
        const filePath = path.join(dir, entry);
        const stat = fs.statSync(filePath);
        hash.update(`${filePath}:${stat.size}:${stat.mtimeMs}\n`);
      }
    } catch {
      // Skip unreadable dirs
    }
  }
  return hash.digest('hex');
}

/**
 * Load rules from global (`~/.frogger/rules/`) and project-level
 * (`{workDir}/.frogger/rules/`) directories.
 *
 * Global rules come first, then project rules. Within each level,
 * files are sorted alphabetically by filename.
 *
 * Uses memoization: re-reads files only when the file set hash changes.
 *
 * Returns `undefined` if no rules files are found.
 * Truncates to `MAX_RULES_SIZE` (50,000 chars) if total content exceeds limit.
 */
export function loadRules(workingDirectory: string): string | undefined {
  const globalDir = path.join(homedir(), CONFIG_DIR, 'rules');
  const projectDir = path.join(workingDirectory, CONFIG_DIR, 'rules');

  // Check cache validity via file set hash
  const currentHash = computeFileSetHash([globalDir, projectDir]);
  if (rulesCache && rulesCache.hash === currentHash) {
    return rulesCache.content;
  }

  const globalFiles = loadMdFiles(globalDir);
  const projectFiles = loadMdFiles(projectDir);
  const all = [...globalFiles, ...projectFiles];

  if (all.length === 0) {
    rulesCache = { hash: currentHash, content: undefined };
    return undefined;
  }

  let content = all.map(f => f.content.trim()).join('\n\n---\n\n');

  if (content.length > MAX_RULES_SIZE) {
    logger.warn(`Rules content exceeds ${MAX_RULES_SIZE} chars (${content.length}), truncating`);
    content = content.slice(0, MAX_RULES_SIZE) + '\n\n[Rules truncated]';
  }

  rulesCache = { hash: currentHash, content };
  return content;
}

/** Clear the rules cache (for testing). */
export function clearRulesCache(): void {
  rulesCache = null;
}
