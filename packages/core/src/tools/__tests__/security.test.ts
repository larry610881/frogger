import { describe, it, expect } from 'vitest';
import { assertWithinBoundary } from '../security.js';

describe('assertWithinBoundary', () => {
  const boundary = '/home/user/project';

  it('allows paths within the boundary', () => {
    expect(() => assertWithinBoundary('src/index.ts', boundary)).not.toThrow();
    expect(() => assertWithinBoundary('./README.md', boundary)).not.toThrow();
    expect(() => assertWithinBoundary('nested/deep/file.ts', boundary)).not.toThrow();
  });

  it('allows absolute paths within the boundary', () => {
    expect(() =>
      assertWithinBoundary('/home/user/project/src/file.ts', boundary),
    ).not.toThrow();
  });

  it('rejects paths that escape via ..', () => {
    expect(() => assertWithinBoundary('../secret', boundary)).toThrow(
      'escapes the working directory boundary',
    );
    expect(() => assertWithinBoundary('src/../../secret', boundary)).toThrow(
      'escapes the working directory boundary',
    );
  });

  it('rejects absolute paths outside boundary', () => {
    expect(() => assertWithinBoundary('/etc/passwd', boundary)).toThrow(
      'escapes the working directory boundary',
    );
  });

  it('rejects paths with null bytes', () => {
    expect(() => assertWithinBoundary('file\0.txt', boundary)).toThrow(
      'null bytes',
    );
  });

  it('normalizes tricky paths correctly', () => {
    // ./../../ should still be caught after normalization
    expect(() => assertWithinBoundary('./../../etc/passwd', boundary)).toThrow(
      'escapes the working directory boundary',
    );
  });
});
