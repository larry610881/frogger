import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { issueCommand } from '../issue.js';
import { execa } from 'execa';

const mockedExeca = vi.mocked(execa);

function createContext() {
  const messages: any[] = [];
  return {
    messagesRef: { current: messages },
    budgetTracker: null,
    model: null,
    providers: [],
    currentProvider: 'test',
    currentModel: 'test-model',
  } as any;
}

describe('/issue command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns usage when no argument is provided', async () => {
    const result = await issueCommand.execute([], createContext());
    expect(result.type).toBe('message');
    expect(result.message).toContain('Usage');
  });

  it('returns usage for non-numeric argument', async () => {
    const result = await issueCommand.execute(['abc'], createContext());
    expect(result.type).toBe('message');
    expect(result.message).toContain('Usage');
  });

  it('strips leading # from issue number', async () => {
    // Auth passes
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    // Issue fetch
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 42,
        title: 'Fix login bug',
        body: 'Login is broken',
        state: 'OPEN',
        labels: [{ name: 'bug' }],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const ctx = createContext();
    const result = await issueCommand.execute(['#42'], ctx);
    expect(result.message).toContain('#42');
    expect(result.message).toContain('fix/42-fix-login-bug');
  });

  it('returns error when gh auth fails', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'not logged in' } as any);

    const result = await issueCommand.execute(['1'], createContext());
    expect(result.type).toBe('error');
    expect(result.message).toContain('not authenticated');
  });

  it('returns error when issue fetch fails', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'not found' } as any);

    const result = await issueCommand.execute(['999'], createContext());
    expect(result.type).toBe('error');
    expect(result.message).toContain('Failed to fetch');
  });

  it('returns error when issue is closed', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 5,
        title: 'Old issue',
        body: '',
        state: 'CLOSED',
        labels: [],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const result = await issueCommand.execute(['5'], createContext());
    expect(result.type).toBe('error');
    expect(result.message).toContain('already closed');
  });

  it('uses fix/ prefix for bug-labeled issues', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 10,
        title: 'Crash on startup',
        body: 'App crashes',
        state: 'OPEN',
        labels: [{ name: 'bug' }],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const ctx = createContext();
    const result = await issueCommand.execute(['10'], ctx);
    expect(result.message).toContain('fix/10-crash-on-startup');
  });

  it('uses feature/ prefix for non-bug issues', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 20,
        title: 'Add dark mode',
        body: 'Support dark theme',
        state: 'OPEN',
        labels: [{ name: 'enhancement' }],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const ctx = createContext();
    const result = await issueCommand.execute(['20'], ctx);
    expect(result.message).toContain('feature/20-add-dark-mode');
  });

  it('injects structured message into messagesRef', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 7,
        title: 'Implement search',
        body: 'We need search functionality',
        state: 'OPEN',
        labels: [],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const ctx = createContext();
    await issueCommand.execute(['7'], ctx);

    expect(ctx.messagesRef.current).toHaveLength(1);
    const msg = ctx.messagesRef.current[0];
    expect(msg.role).toBe('user');
    expect(msg.content).toContain('Issue #7');
    expect(msg.content).toContain('Closes #7');
    expect(msg.content).toContain('feature/7-implement-search');
  });

  it('sanitizes special characters in branch name', async () => {
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any);
    mockedExeca.mockResolvedValueOnce({
      exitCode: 0,
      stdout: JSON.stringify({
        number: 3,
        title: 'Fix: "weird" $chars & stuff!',
        body: '',
        state: 'OPEN',
        labels: [{ name: 'bug' }],
        assignees: [],
      }),
      stderr: '',
    } as any);

    const ctx = createContext();
    const result = await issueCommand.execute(['3'], ctx);
    // Branch name should only contain alphanumeric + hyphens
    expect(result.message).toMatch(/fix\/3-[a-z0-9-]+/);
    // Extract branch name and verify it has no special characters
    const branchMatch = result.message.match(/Branch: (.+)$/m);
    expect(branchMatch).not.toBeNull();
    expect(branchMatch![1]).toMatch(/^(fix|feature)\/\d+-[a-z0-9-]+$/);
  });
});
