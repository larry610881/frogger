import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock execa before importing
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { createGhIssueTool, ghIssueMetadata } from '../gh-issue.js';
import { execa } from 'execa';

const mockedExeca = vi.mocked(execa);

describe('gh-issue tool', () => {
  const workingDirectory = '/test/repo';
  let tool: ReturnType<typeof createGhIssueTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = createGhIssueTool(workingDirectory);
  });

  describe('metadata', () => {
    it('has correct name and permission level', () => {
      expect(ghIssueMetadata.name).toBe('gh-issue');
      expect(ghIssueMetadata.permissionLevel).toBe('auto');
    });
  });

  describe('execute', () => {
    const issueData = {
      number: 42,
      title: 'Fix the bug',
      body: 'There is a bug in the code.',
      state: 'OPEN',
      labels: [{ name: 'bug' }, { name: 'priority' }],
      assignees: [{ login: 'dev1' }],
      milestone: null,
      createdAt: '2024-01-01T00:00:00Z',
      author: { login: 'reporter' },
    };

    it('reads issue details successfully', async () => {
      mockedExeca
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(issueData), stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ comments: [] }), stderr: '' } as any);

      const result = await (tool as any).execute({ number: 42 }, {});

      expect(result).toContain('Issue #42: Fix the bug');
      expect(result).toContain('bug, priority');
      expect(result).toContain('dev1');
      expect(mockedExeca).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['issue', 'view', '42']),
        expect.objectContaining({ cwd: workingDirectory }),
      );
    });

    it('includes comments when present', async () => {
      mockedExeca
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(issueData), stderr: '' } as any)
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({
            comments: [{ author: { login: 'user1' }, body: 'Me too!', createdAt: '2024-01-02T00:00:00Z' }],
          }),
          stderr: '',
        } as any);

      const result = await (tool as any).execute({ number: 42 }, {});
      expect(result).toContain('Comments (1)');
      expect(result).toContain('Me too!');
    });

    it('skips comments when includeComments is false', async () => {
      mockedExeca
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(issueData), stderr: '' } as any);

      const result = await (tool as any).execute({ number: 42, includeComments: false }, {});
      expect(result).toContain('Issue #42');
      // Should only call execa once (no comments fetch)
      expect(mockedExeca).toHaveBeenCalledTimes(1);
    });

    it('passes --repo flag when provided', async () => {
      mockedExeca
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify(issueData), stderr: '' } as any)
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ comments: [] }), stderr: '' } as any);

      await (tool as any).execute({ number: 1, repo: 'owner/repo' }, {});

      expect(mockedExeca).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--repo', 'owner/repo']),
        expect.any(Object),
      );
    });

    it('returns error when gh command fails', async () => {
      mockedExeca
        .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'issue not found' } as any);

      const result = await (tool as any).execute({ number: 999 }, {});
      expect(result).toContain('Error reading issue #999');
    });

    it('handles exception gracefully', async () => {
      mockedExeca.mockRejectedValueOnce(new Error('gh not installed'));

      const result = await (tool as any).execute({ number: 1 }, {});
      expect(result).toContain('Error: gh not installed');
    });
  });
});
