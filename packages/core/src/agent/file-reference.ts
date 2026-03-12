import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_EXTENSIONS, IMAGE_MEDIA_TYPES, MAX_IMAGE_FILE_SIZE } from '@frogger/shared';
import { assertWithinBoundary } from '../tools/security.js';

export interface ImageReference {
  path: string;
  base64: string;
  mediaType: string;
}

export interface FileReferenceResult {
  cleanText: string;
  references: Array<{
    path: string;
    content: string;
    lineCount: number;
  }>;
  imageReferences: ImageReference[];
  errors: string[];
}

/** Check if a file path is an image based on its extension */
export function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function resolveFileReferences(
  text: string,
  workingDirectory: string,
): Promise<FileReferenceResult> {
  const references: FileReferenceResult['references'] = [];
  const imageReferences: ImageReference[] = [];
  const errors: FileReferenceResult['errors'] = [];
  const tokensToRemove: string[] = [];

  // Match @"path with spaces" (quoted) or @path/to/file (unquoted)
  const regex = /@"([^"]+)"|@([\w./\-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchedPath = match[1] ?? match[2]; // [1] = quoted, [2] = unquoted
    const fullToken = match[0];
    const resolvedPath = path.resolve(workingDirectory, matchedPath);

    try {
      // Check if the path exists on disk first — if not, it's likely an @mention
      await fs.access(resolvedPath);
    } catch {
      // Path doesn't exist — skip silently (probably an @mention, not a file ref)
      continue;
    }

    try {
      assertWithinBoundary(matchedPath, workingDirectory);

      if (isImageFile(matchedPath)) {
        // Check file size before reading
        const stat = await fs.stat(resolvedPath);
        if (stat.size > MAX_IMAGE_FILE_SIZE) {
          errors.push(`${matchedPath}: image too large (${(stat.size / 1024 / 1024).toFixed(1)}MB, max 5MB)`);
          tokensToRemove.push(fullToken);
          continue;
        }
        // Read image as binary and base64 encode
        const buffer = await fs.readFile(resolvedPath);
        const base64 = buffer.toString('base64');
        const ext = path.extname(matchedPath).toLowerCase();
        const mediaType = IMAGE_MEDIA_TYPES[ext] ?? 'application/octet-stream';
        imageReferences.push({ path: matchedPath, base64, mediaType });
      } else {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const lineCount = content.split('\n').length;
        references.push({ path: matchedPath, content, lineCount });
      }
      tokensToRemove.push(fullToken);
    } catch (err) {
      errors.push(
        `${matchedPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      tokensToRemove.push(fullToken);
    }
  }

  let cleanText = text;
  for (const token of tokensToRemove) {
    cleanText = cleanText.replace(token, '');
  }
  // Collapse multiple spaces into one and trim
  cleanText = cleanText.replace(/  +/g, ' ').trim();

  return { cleanText, references, imageReferences, errors };
}
