import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execa before importing
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { createGhPrTool, ghPrMetadata } from '../gh-pr.js';
import { execa } from 'execa';

const mockedExeca = vi.mocked(execa);

describe('gh-pr tool', () => {
  const workingDirectory = '/test/repo';
  let tool: ReturnType<typeof createGhPrTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = createGhPrTool(workingDirectory);
  });

  describe('metadata', () => {
    it('has correct name and permission level', () => {
      expect(ghPrMetadata.name).toBe('gh-pr');
      expect(ghPrMetadata.permissionLevel).toBe('confirm');
    });
  });

  describe('execute', () => {
    it('creates a PR successfully', async () => {
      mockedExeca.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'https://github.com/owner/repo/pull/123',
        stderr: '',
      } as any);

      const result = await (tool as any).execute({
        title: 'Add feature X',
        body: 'This PR adds feature X',
      }, {});

      expect(result).toContain('Pull request created successfully');
      expect(result).toContain('https://github.com/owner/repo/pull/123');
    });

    it('passes all optional parameters as array args (no shell injection)', async () => {
      mockedExeca.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'https://github.com/owner/repo/pull/124',
        stderr: '',
      } as any);

      await (tool as any).execute({
        title: 'Test PR',
        body: 'Body with "quotes" and $(command)',
        base: 'main',
        head: 'feature/test',
        draft: true,
        labels: ['bug', 'urgent'],
        repo: 'owner/repo',
      }, {});

      const call = mockedExeca.mock.calls[0]!;
      const args = call[1] as string[];

      // Verify args are passed as array elements (not shell-interpolated)
      expect(args).toContain('--title');
      expect(args).toContain('Test PR');
      expect(args).toContain('--body');
      expect(args).toContain('Body with "quotes" and $(command)');
      expect(args).toContain('--base');
      expect(args).toContain('main');
      expect(args).toContain('--head');
      expect(args).toContain('feature/test');
      expect(args).toContain('--draft');
      expect(args).toContain('--label');
      expect(args).toContain('bug,urgent');
      expect(args).toContain('--repo');
      expect(args).toContain('owner/repo');
    });

    it('returns error when gh command fails', async () => {
      mockedExeca.mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'pull request already exists',
      } as any);

      const result = await (tool as any).execute({
        title: 'Test',
        body: 'Body',
      }, {});

      expect(result).toContain('Error creating PR');
      expect(result).toContain('pull request already exists');
    });

    it('handles exception gracefully', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('gh not installed'));

      const result = await (tool as any).execute({
        title: 'Test',
        body: 'Body',
      }, {});

      expect(result).toContain('Error: gh not installed');
    });

    it('does not include --draft when not specified', async () => {
      mockedExeca.mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'https://github.com/owner/repo/pull/125',
        stderr: '',
      } as any);

      await (tool as any).execute({
        title: 'Test',
        body: 'Body',
      }, {});

      const args = (mockedExeca.mock.calls[0]![1] as string[]);
      expect(args).not.toContain('--draft');
    });
  });
});
