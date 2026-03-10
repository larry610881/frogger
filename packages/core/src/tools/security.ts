import path from 'node:path';

/**
 * Validates that targetPath is within boundaryDir.
 * Throws if the path escapes the boundary or contains null bytes.
 */
export function assertWithinBoundary(
  targetPath: string,
  boundaryDir: string,
): void {
  if (targetPath.includes('\0')) {
    throw new Error('Path contains null bytes');
  }

  const resolved = path.resolve(boundaryDir, targetPath);
  const relative = path.relative(boundaryDir, resolved);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Path "${targetPath}" escapes the working directory boundary`,
    );
  }
}
