import { globby } from 'globby';
import path from 'node:path';

export interface RepoMapOptions {
  workingDirectory: string;
  maxFiles?: number;       // default 500
  maxOutputChars?: number; // default 8000
}

/** Cache entry with TTL */
interface CacheEntry {
  result: string | undefined;
  timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const repoMapCache = new Map<string, CacheEntry>();

/** Clear the repo map cache (for testing). */
export function clearRepoMapCache(): void {
  repoMapCache.clear();
}

/**
 * Generate a file tree representation of the repository.
 * Uses globby (gitignore-aware) to list files and builds an indented tree.
 *
 * Returns undefined for empty directories.
 * Returns a "[repo: N files, too large for map]" notice when file count exceeds maxFiles.
 */
export async function generateRepoMap(options: RepoMapOptions): Promise<string | undefined> {
  const { workingDirectory, maxFiles = 500, maxOutputChars = 8000 } = options;

  // Check cache
  const cacheKey = `${workingDirectory}:${maxFiles}:${maxOutputChars}`;
  const cached = repoMapCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const files = await globby('**/*', {
    cwd: workingDirectory,
    gitignore: true,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**', '*.lock'],
    dot: false,
  });

  if (files.length === 0) {
    repoMapCache.set(cacheKey, { result: undefined, timestamp: Date.now() });
    return undefined;
  }

  if (files.length > maxFiles) {
    const tooLarge = `[repo: ${files.length} files, too large for map]`;
    repoMapCache.set(cacheKey, { result: tooLarge, timestamp: Date.now() });
    return tooLarge;
  }

  // Sort files for consistent output
  files.sort();

  // Build tree structure
  const tree = buildTree(files);
  const output = renderTree(tree, '');

  let result: string;
  if (output.length > maxOutputChars) {
    result = output.slice(0, maxOutputChars) + '\n... (truncated)';
  } else {
    result = output;
  }

  repoMapCache.set(cacheKey, { result, timestamp: Date.now() });
  return result;
}

interface TreeNode {
  [key: string]: TreeNode | null; // null = file, object = directory
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = {};
  for (const file of files) {
    const parts = file.split(path.posix.sep);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Leaf file
        current[part] = null;
      } else {
        if (!current[part] || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as TreeNode;
      }
    }
  }
  return root;
}

function renderTree(node: TreeNode, prefix: string): string {
  const entries = Object.entries(node);
  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [name, child] = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    if (child === null) {
      // File
      lines.push(`${prefix}${connector}${name}`);
    } else {
      // Directory
      lines.push(`${prefix}${connector}${name}/`);
      lines.push(renderTree(child, prefix + childPrefix));
    }
  }

  return lines.filter(l => l.length > 0).join('\n');
}
