import { globby } from 'globby';
import path from 'node:path';

export interface RepoMapOptions {
  workingDirectory: string;
  maxFiles?: number;       // default 500
  maxOutputChars?: number; // default 8000
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

  const files = await globby('**/*', {
    cwd: workingDirectory,
    gitignore: true,
    ignore: ['node_modules/**', '.git/**', 'dist/**', 'coverage/**', '*.lock'],
    dot: false,
  });

  if (files.length === 0) return undefined;

  if (files.length > maxFiles) {
    return `[repo: ${files.length} files, too large for map]`;
  }

  // Sort files for consistent output
  files.sort();

  // Build tree structure
  const tree = buildTree(files);
  const output = renderTree(tree, '');

  if (output.length > maxOutputChars) {
    return output.slice(0, maxOutputChars) + '\n... (truncated)';
  }

  return output;
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
