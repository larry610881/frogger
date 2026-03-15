import { tool } from 'ai';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolMetadata } from '@frogger/shared';
import { assertWithinBoundary } from './security.js';

export const analyzeRepoMetadata: ToolMetadata = {
  name: 'analyze-repo',
  description: 'Analyze repository structure: directory tree, key files, and file type distribution',
  permissionLevel: 'auto',
};

const SKIP_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build',
  '.next', '.nuxt', '.cache', 'coverage', '.turbo',
]);

interface KeyFileInfo {
  name: string;
  label: string;
}

const KEY_FILES: Record<string, KeyFileInfo> = {
  'README.md': { name: 'README.md', label: 'documentation' },
  'readme.md': { name: 'readme.md', label: 'documentation' },
  'package.json': { name: 'package.json', label: 'Node.js project' },
  'setup.py': { name: 'setup.py', label: 'Python project' },
  'pyproject.toml': { name: 'pyproject.toml', label: 'Python project' },
  'Cargo.toml': { name: 'Cargo.toml', label: 'Rust project' },
  'go.mod': { name: 'go.mod', label: 'Go module' },
  'Makefile': { name: 'Makefile', label: 'build automation' },
  'Dockerfile': { name: 'Dockerfile', label: 'Docker container' },
  'docker-compose.yml': { name: 'docker-compose.yml', label: 'Docker Compose' },
  'docker-compose.yaml': { name: 'docker-compose.yaml', label: 'Docker Compose' },
  'tsconfig.json': { name: 'tsconfig.json', label: 'TypeScript config' },
  '.gitignore': { name: '.gitignore', label: 'Git ignore rules' },
};

const ICON_MAP: Record<string, string> = {
  'README.md': '\u{1F4C4}',
  'readme.md': '\u{1F4C4}',
  'package.json': '\u{1F4E6}',
  'setup.py': '\u{1F40D}',
  'pyproject.toml': '\u{1F40D}',
  'Cargo.toml': '\u{1F980}',
  'go.mod': '\u{1F4E6}',
  'Makefile': '\u{1F527}',
  'Dockerfile': '\u{1F433}',
  'docker-compose.yml': '\u{1F433}',
  'docker-compose.yaml': '\u{1F433}',
};

const TEST_DIR_NAMES = new Set([
  'test', 'tests', '__tests__', 'spec', 'specs',
  'test_', 'e2e', 'integration', 'unit',
]);

interface TreeEntry {
  name: string;
  isDir: boolean;
  children?: TreeEntry[];
}

async function walkDirectory(
  dir: string,
  boundaryDir: string,
  currentDepth: number,
  maxDepth: number,
): Promise<TreeEntry[]> {
  if (currentDepth > maxDepth) return [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const result: TreeEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const childPath = path.join(dir, entry.name);

      // Check symlink safety
      try {
        const realPath = await fs.realpath(childPath);
        const relative = path.relative(boundaryDir, realPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      } catch {
        continue;
      }

      const children = await walkDirectory(childPath, boundaryDir, currentDepth + 1, maxDepth);
      result.push({ name: entry.name, isDir: true, children });
    } else {
      result.push({ name: entry.name, isDir: false });
    }
  }

  return result;
}

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) {
    if (TEST_DIR_NAMES.has(name.toLowerCase())) return '\u{1F9EA}';
    return '\u{1F4C1}';
  }
  return ICON_MAP[name] ?? '';
}

function renderTree(
  entries: TreeEntry[],
  prefix: string,
  extensionCounts: Map<string, number>,
  keyFilesFound: string[],
): string[] {
  const lines: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '\u2514\u2500\u2500 ' : '\u251C\u2500\u2500 ';
    const childPrefix = isLast ? '    ' : '\u2502   ';

    const icon = getFileIcon(entry.name, entry.isDir);
    const iconStr = icon ? `${icon} ` : '';

    if (entry.isDir) {
      lines.push(`${prefix}${connector}${iconStr}${entry.name}/`);
      if (entry.children && entry.children.length > 0) {
        const childLines = renderTree(entry.children, prefix + childPrefix, extensionCounts, keyFilesFound);
        lines.push(...childLines);
      }
    } else {
      lines.push(`${prefix}${connector}${iconStr}${entry.name}`);
      // Count extensions
      const ext = path.extname(entry.name).toLowerCase();
      if (ext) {
        extensionCounts.set(ext, (extensionCounts.get(ext) ?? 0) + 1);
      }
      // Track key files
      if (KEY_FILES[entry.name]) {
        keyFilesFound.push(entry.name);
      }
    }
  }

  return lines;
}

export function createAnalyzeRepoTool(workingDirectory: string) {
  return tool({
    description: analyzeRepoMetadata.description,
    inputSchema: z.object({
      path: z.string().optional().describe('Subdirectory to analyze (default: repo root)'),
      depth: z.number().int().min(1).max(10).optional().describe('Max directory depth (default: 3)'),
    }),
    execute: async ({ path: subPath, depth: maxDepth }) => {
      try {
        const targetDir = subPath
          ? path.resolve(workingDirectory, subPath)
          : workingDirectory;

        if (subPath) {
          assertWithinBoundary(subPath, workingDirectory);
        }

        // Verify directory exists
        const stat = await fs.stat(targetDir);
        if (!stat.isDirectory()) {
          return `Error: "${subPath ?? '.'}" is not a directory`;
        }

        const depth = maxDepth ?? 3;
        const dirName = path.basename(targetDir);
        const entries = await walkDirectory(targetDir, workingDirectory, 1, depth);

        const extensionCounts = new Map<string, number>();
        const keyFilesFound: string[] = [];

        const treeLines = renderTree(entries, '', extensionCounts, keyFilesFound);

        // Build output
        const lines: string[] = [];
        lines.push(`## Repository Structure (depth: ${depth})`);
        lines.push('');
        lines.push(`\u{1F4C1} ${dirName}/`);
        lines.push(...treeLines);

        // File types section
        if (extensionCounts.size > 0) {
          lines.push('');
          lines.push('## File Types');
          const sorted = [...extensionCounts.entries()].sort((a, b) => b[1] - a[1]);
          for (const [ext, count] of sorted) {
            lines.push(`- ${ext}: ${count} file${count > 1 ? 's' : ''}`);
          }
        }

        // Key files section
        if (keyFilesFound.length > 0) {
          lines.push('');
          lines.push('## Key Files');
          const unique = [...new Set(keyFilesFound)];
          for (const name of unique) {
            const info = KEY_FILES[name];
            if (info) {
              lines.push(`- ${name} (${info.label})`);
            }
          }
        }

        return lines.join('\n');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error: ${message}`;
      }
    },
  });
}
