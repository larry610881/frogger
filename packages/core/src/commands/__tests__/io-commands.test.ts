import type { SlashCommandContext } from '../types.js';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so vi.mock hoisting works correctly
// ---------------------------------------------------------------------------

// compact: mock compactMessages
vi.mock('../../agent/compact.js', () => ({
  compactMessages: vi.fn(),
}));

// sessions / resume: mock SessionManager
const { mockSessionList, mockSessionLoad, mockSessionGetLatest } = vi.hoisted(() => ({
  mockSessionList: vi.fn().mockResolvedValue([]),
  mockSessionLoad: vi.fn().mockResolvedValue(null),
  mockSessionGetLatest: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../agent/session.js', () => {
  class MockSessionManager {
    list = mockSessionList;
    load = mockSessionLoad;
    getLatest = mockSessionGetLatest;
  }
  return { SessionManager: MockSessionManager };
});

// undo: mock execa (top-level named export)
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// doctor: mock config module
vi.mock('../../config/config.js', () => ({
  loadConfig: vi.fn(),
  findProvider: vi.fn(),
}));

// git-auth: mock git-auth-utils
vi.mock('../../tools/git-auth-utils.js', () => ({
  detectGitAuthStatus: vi.fn(),
  loadGitCredentials: vi.fn(),
  saveGitCredentials: vi.fn(),
}));

// doctor: mock update-check
vi.mock('../update-check.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../update-check.js')>();
  return {
    ...orig,
    checkForUpdate: vi.fn(),
    formatUpdateMessage: vi.fn().mockReturnValue(''),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mock declarations)
// ---------------------------------------------------------------------------
import { compactCommand } from '../compact.js';
import { compactMessages } from '../../agent/compact.js';
import { COMPACT_PRESERVE_RECENT } from '@frogger/shared';

import { createRewindCommand } from '../rewind.js';
import type { CheckpointManager, Checkpoint, RestoreResult } from '../../agent/checkpoint.js';

import { undoCommand } from '../undo.js';
import { execa } from 'execa';

import { sessionsCommand } from '../sessions.js';
import { resumeCommand } from '../resume.js';

import { doctorCommand } from '../doctor.js';
import { loadConfig, findProvider } from '../../config/config.js';

import { gitAuthCommand } from '../git-auth.js';
import {
  detectGitAuthStatus,
  loadGitCredentials,
  saveGitCredentials,
} from '../../tools/git-auth-utils.js';

import { checkForUpdate, formatUpdateMessage } from '../update-check.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<SlashCommandContext>): SlashCommandContext {
  return {
    messagesRef: { current: [] },
    budgetTracker: null,
    model: null,
    providers: [],
    currentProvider: 'deepseek',
    currentModel: 'deepseek-chat',
    ...overrides,
  };
}

/** Build N dummy messages for compact tests. */
function makeDummyMessages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `message-${i}`,
  }));
}

// ==========================================================================
// /compact
// ==========================================================================
describe('compactCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when no model is configured', async () => {
    const ctx = makeContext({ model: null });
    const result = await compactCommand.execute([], ctx);

    expect(result.type).toBe('error');
    expect(result.message).toBe('No model configured. Run /setup first.');
  });

  it('returns "not enough messages" when messages <= COMPACT_PRESERVE_RECENT', async () => {
    const ctx = makeContext({
      model: {} as any,
      messagesRef: { current: makeDummyMessages(COMPACT_PRESERVE_RECENT) as any },
    });

    const result = await compactCommand.execute([], ctx);

    expect(result.type).toBe('message');
    expect(result.message).toBe('Not enough messages to compact.');
    expect(compactMessages).not.toHaveBeenCalled();
  });

  it('compacts successfully — updates messagesRef and calls onCompactDone', async () => {
    const originalMessages = makeDummyMessages(COMPACT_PRESERVE_RECENT + 5) as any;
    const compactedMessages = [{ role: 'user', content: '[summary]' }] as any;
    const onCompactDone = vi.fn();

    vi.mocked(compactMessages).mockResolvedValue({
      messages: compactedMessages,
      summary: 'A summary of the conversation.',
      compactedCount: 5,
    });

    const ctx = makeContext({
      model: {} as any,
      messagesRef: { current: originalMessages },
      onCompactDone,
    });

    const result = await compactCommand.execute([], ctx);

    expect(compactMessages).toHaveBeenCalledWith({}, originalMessages);
    expect(ctx.messagesRef.current).toBe(compactedMessages);
    expect(onCompactDone).toHaveBeenCalledWith('A summary of the conversation.', 5);
    expect(result.type).toBe('message');
    expect(result.message).toBe('Compacted 5 messages into summary.');
  });

  it('returns correct count in the success message', async () => {
    vi.mocked(compactMessages).mockResolvedValue({
      messages: [],
      summary: 'sum',
      compactedCount: 12,
    });

    const ctx = makeContext({
      model: {} as any,
      messagesRef: { current: makeDummyMessages(COMPACT_PRESERVE_RECENT + 12) as any },
    });

    const result = await compactCommand.execute([], ctx);
    expect(result.message).toBe('Compacted 12 messages into summary.');
  });
});

// ==========================================================================
// /rewind
// ==========================================================================
describe('rewindCommand', () => {
  function makeMockCheckpointManager(
    checkpoints: Checkpoint[] = [],
    restoreResult?: RestoreResult,
    restoreError?: Error,
  ): CheckpointManager {
    return {
      getCheckpoints: vi.fn(() => checkpoints),
      restoreCheckpoint: vi.fn(async () => {
        if (restoreError) throw restoreError;
        return restoreResult!;
      }),
    } as unknown as CheckpointManager;
  }

  const sampleCheckpoints: Checkpoint[] = [
    {
      id: 1,
      toolName: 'write-file',
      toolArgs: { path: 'foo.ts' },
      messageIndex: 2,
      timestamp: 1700000000000,
      fileSnapshots: [{ path: 'foo.ts', content: 'old content' }],
      createdFiles: [],
    },
    {
      id: 2,
      toolName: 'edit-file',
      toolArgs: { path: 'bar.ts' },
      messageIndex: 5,
      timestamp: 1700000060000,
      fileSnapshots: [{ path: 'bar.ts', content: 'original' }],
      createdFiles: ['new-file.ts'],
    },
  ];

  it('returns "no checkpoints" when list is empty', async () => {
    const cmd = createRewindCommand(makeMockCheckpointManager([]));
    const result = await cmd.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toBe('No checkpoints available.');
  });

  it('lists checkpoints when called with no args', async () => {
    const mgr = makeMockCheckpointManager(sampleCheckpoints);
    const cmd = createRewindCommand(mgr);

    const result = await cmd.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('Checkpoints:');
    expect(result.message).toContain('#1');
    expect(result.message).toContain('write-file');
    expect(result.message).toContain('#2');
    expect(result.message).toContain('edit-file');
    expect(result.message).toContain('/rewind last');
  });

  it('restores the last checkpoint when arg is "last"', async () => {
    const restoreResult: RestoreResult = {
      messageIndex: 5,
      restoredFiles: ['bar.ts'],
      deletedFiles: ['new-file.ts'],
    };
    const mgr = makeMockCheckpointManager(sampleCheckpoints, restoreResult);
    const cmd = createRewindCommand(mgr);

    const result = await cmd.execute(['last'], makeContext());

    expect(mgr.restoreCheckpoint).toHaveBeenCalledWith(2); // last checkpoint id
    expect(result.type).toBe('message');
    expect(result.message).toContain('Rewound to checkpoint #2');
    expect(result.message).toContain('Restored: bar.ts');
    expect(result.message).toContain('Deleted: new-file.ts');
    expect(result.messageIndex).toBe(5);
  });

  it('restores a specific checkpoint by numeric ID', async () => {
    const restoreResult: RestoreResult = {
      messageIndex: 2,
      restoredFiles: ['foo.ts'],
      deletedFiles: [],
    };
    const mgr = makeMockCheckpointManager(sampleCheckpoints, restoreResult);
    const cmd = createRewindCommand(mgr);

    const result = await cmd.execute(['1'], makeContext());

    expect(mgr.restoreCheckpoint).toHaveBeenCalledWith(1);
    expect(result.type).toBe('message');
    expect(result.message).toContain('Rewound to checkpoint #1');
    expect(result.message).toContain('Restored: foo.ts');
    // No "Deleted:" line since deletedFiles is empty
    expect(result.message).not.toContain('Deleted:');
  });

  it('returns error for non-numeric ID', async () => {
    const mgr = makeMockCheckpointManager(sampleCheckpoints);
    const cmd = createRewindCommand(mgr);

    const result = await cmd.execute(['abc'], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toBe('Invalid checkpoint id: abc');
  });

  it('returns error when restoreCheckpoint throws', async () => {
    const mgr = makeMockCheckpointManager(
      sampleCheckpoints,
      undefined,
      new Error('Checkpoint #99 not found'),
    );
    const cmd = createRewindCommand(mgr);

    const result = await cmd.execute(['1'], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Rewind failed:');
    expect(result.message).toContain('Checkpoint #99 not found');
  });
});

// ==========================================================================
// /undo
// ==========================================================================
describe('undoCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when git log fails (not a repo)', async () => {
    vi.mocked(execa).mockResolvedValue({
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
    } as any);

    const result = await undoCommand.execute([], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toBe('Not a git repository or no commits found.');
  });

  it('returns error when git revert fails', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'abc1234 last commit message',
        stderr: '',
      } as any)
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'error: could not revert HEAD',
      } as any);

    const result = await undoCommand.execute([], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Failed to revert:');
    expect(result.message).toContain('error: could not revert HEAD');
    expect(result.message).toContain('resolve conflicts manually');
  });

  it('returns success with commit info on successful revert', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: 'abc1234 feat: add something',
        stderr: '',
      } as any)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: '[main def5678] Revert "feat: add something"',
        stderr: '',
      } as any);

    const result = await undoCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('Reverted commit: abc1234 feat: add something');
    expect(result.message).toContain('Revert "feat: add something"');
  });

  it('catches exceptions and returns error', async () => {
    vi.mocked(execa).mockRejectedValue(new Error('spawn ENOENT'));

    const result = await undoCommand.execute([], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Error:');
    expect(result.message).toContain('spawn ENOENT');
  });
});

// ==========================================================================
// /sessions
// ==========================================================================
describe('sessionsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionList.mockResolvedValue([]);
    mockSessionLoad.mockResolvedValue(null);
    mockSessionGetLatest.mockResolvedValue(null);
  });

  it('returns "no saved sessions" when list is empty', async () => {
    mockSessionList.mockResolvedValue([]);

    const result = await sessionsCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toBe('No saved sessions found.');
    expect(mockSessionList).toHaveBeenCalledWith(10);
  });

  it('lists sessions with id, date, directory, message count, tokens, and provider', async () => {
    const mockSessions = [
      {
        id: 'sess-abc',
        updatedAt: '2025-01-15T10:30:00.000Z',
        workingDirectory: '/home/user/project',
        totalTokens: 5000,
        messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      },
    ];
    mockSessionList.mockResolvedValue(mockSessions);

    const result = await sessionsCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('Recent sessions:');
    expect(result.message).toContain('sess-abc');
    expect(result.message).toContain('2 msgs');
    expect(result.message).toContain('5,000 tokens');
    expect(result.message).toContain('anthropic/claude-sonnet-4-20250514');
    expect(result.message).toContain('/resume');
  });

  it('replaces HOME directory prefix with ~', async () => {
    const home = process.env.HOME ?? '/home/test';
    const mockSessions = [
      {
        id: 'sess-home',
        updatedAt: '2025-06-01T12:00:00.000Z',
        workingDirectory: `${home}/my-project`,
        totalTokens: 100,
        messages: [{ role: 'user', content: 'hi' }],
        provider: 'deepseek',
        model: 'deepseek-chat',
      },
    ];
    mockSessionList.mockResolvedValue(mockSessions);

    const result = await sessionsCommand.execute([], makeContext());

    expect(result.message).toContain('~/my-project');
  });
});

// ==========================================================================
// /resume
// ==========================================================================
describe('resumeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionList.mockResolvedValue([]);
    mockSessionLoad.mockResolvedValue(null);
    mockSessionGetLatest.mockResolvedValue(null);
  });

  it('returns usage error when no args are provided', async () => {
    const result = await resumeCommand.execute([], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Usage:');
    expect(result.message).toContain('/resume');
  });

  it('returns error when session is not found', async () => {
    mockSessionLoad.mockResolvedValue(null);

    const result = await resumeCommand.execute(['nonexistent-id'], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Session not found: nonexistent-id');
  });

  it('calls getLatest when arg is "latest" and restores messages', async () => {
    const sessionMessages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    mockSessionGetLatest.mockResolvedValue({
      id: 'sess-latest',
      updatedAt: '2025-06-01T12:00:00.000Z',
      messages: sessionMessages,
      provider: 'openai',
      model: 'gpt-4o',
    });

    const ctx = makeContext();
    const result = await resumeCommand.execute(['latest'], ctx);

    expect(mockSessionGetLatest).toHaveBeenCalled();
    expect(ctx.messagesRef.current).toHaveLength(2);
    expect(ctx.messagesRef.current[0]).toEqual(sessionMessages[0]);
    expect(result.type).toBe('message');
    expect(result.message).toContain('Session restored: sess-latest');
    expect(result.message).toContain('Messages: 2');
    expect(result.message).toContain('openai/gpt-4o');
  });

  it('calls load with specific ID and restores messages', async () => {
    const sessionMessages = [{ role: 'user', content: 'saved msg' }];
    mockSessionLoad.mockResolvedValue({
      id: 'sess-xyz',
      updatedAt: '2025-03-10T08:00:00.000Z',
      messages: sessionMessages,
      provider: 'deepseek',
      model: 'deepseek-chat',
    });

    const ctx = makeContext();
    const result = await resumeCommand.execute(['sess-xyz'], ctx);

    expect(mockSessionLoad).toHaveBeenCalledWith('sess-xyz');
    expect(ctx.messagesRef.current).toHaveLength(1);
    expect(result.type).toBe('message');
    expect(result.message).toContain('Session restored: sess-xyz');
    expect(result.message).toContain('Continue from where you left off');
  });

  it('handles session with empty messages array', async () => {
    mockSessionLoad.mockResolvedValue({
      id: 'sess-empty',
      updatedAt: '2025-06-01T12:00:00.000Z',
      messages: [],
      provider: 'deepseek',
      model: 'deepseek-chat',
    });

    const ctx = makeContext();
    const result = await resumeCommand.execute(['sess-empty'], ctx);

    expect(result.type).toBe('message');
    expect(result.message).toContain('Session restored: sess-empty');
    expect(result.message).toContain('Messages: 0');
    expect(ctx.messagesRef.current).toHaveLength(0);
  });
});

// ==========================================================================
// /doctor
// ==========================================================================
describe('doctorCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows checkmarks for all tools when everything is found', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-test-key',
    });
    vi.mocked(findProvider).mockReturnValue({
      name: 'anthropic',
      label: 'Anthropic',
      type: 'anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      models: [],
      defaultModel: 'claude-sonnet-4-20250514',
    });

    // doctor uses dynamic import('execa') internally, so we mock the module
    // The vi.mock('execa') at the top provides the mock for dynamic imports too
    vi.mocked(execa).mockResolvedValue({
      exitCode: 0,
      stdout: 'git version 2.43.0',
      stderr: '',
    } as any);

    const ctx = makeContext({
      currentProvider: 'anthropic',
      currentModel: 'claude-sonnet-4-20250514',
    });

    const result = await doctorCommand.execute([], ctx);

    expect(result.type).toBe('message');
    expect(result.message).toContain('Environment Check:');
    // Node.js is always ok
    expect(result.message).toContain('\u2713');
    expect(result.message).toContain('Node.js');
    // Provider info from context
    expect(result.message).toContain('anthropic');
    expect(result.message).toContain('claude-sonnet-4-20250514');
  });

  it('shows X marks for missing tools', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: undefined,
    });
    vi.mocked(findProvider).mockReturnValue(undefined);

    // Make execa throw (tools not found)
    vi.mocked(execa).mockRejectedValue(new Error('not found'));

    const ctx = makeContext();
    const result = await doctorCommand.execute([], ctx);

    expect(result.type).toBe('message');
    // API key not configured → X mark
    expect(result.message).toContain('\u2717');
    expect(result.message).toContain('not configured');
  });

  it('shows provider info from the context', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-key',
    });
    vi.mocked(findProvider).mockReturnValue({
      name: 'openai',
      label: 'OpenAI',
      type: 'openai',
      envKey: 'OPENAI_API_KEY',
      models: [],
      defaultModel: 'gpt-4o',
    });
    vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: 'v2.0', stderr: '' } as any);

    const ctx = makeContext({
      currentProvider: 'openai',
      currentModel: 'gpt-4o',
    });

    const result = await doctorCommand.execute([], ctx);

    expect(result.message).toContain('openai');
    expect(result.message).toContain('gpt-4o');
  });

  it('shows capabilities when provider entry is found', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: 'sk-key',
    });
    vi.mocked(findProvider).mockReturnValue({
      name: 'anthropic',
      label: 'Anthropic',
      type: 'anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      models: [],
      defaultModel: 'claude-sonnet-4-20250514',
    });
    vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: 'v2.0', stderr: '' } as any);
    vi.mocked(checkForUpdate).mockResolvedValue({
      currentVersion: '0.8.0',
      latestVersion: '0.8.0',
      updateAvailable: false,
      updateCommand: 'npm install -g frogger',
    });
    vi.mocked(formatUpdateMessage).mockReturnValue('');

    const result = await doctorCommand.execute([], makeContext({
      currentProvider: 'anthropic',
      currentModel: 'claude-sonnet-4-20250514',
    }));

    expect(result.message).toContain('Capabilities');
    expect(result.message).toContain('vision \u2713');
    expect(result.message).toContain('thinking \u2713');
    expect(result.message).toContain('caching \u2713');
  });

  it('skips capabilities when provider entry is undefined', async () => {
    vi.mocked(loadConfig).mockReturnValue({
      provider: 'unknown',
      model: 'unknown-model',
      apiKey: 'sk-key',
    });
    vi.mocked(findProvider).mockReturnValue(undefined);
    vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: 'v2.0', stderr: '' } as any);
    vi.mocked(checkForUpdate).mockResolvedValue({
      currentVersion: '0.8.0',
      latestVersion: '0.8.0',
      updateAvailable: false,
      updateCommand: 'npm install -g frogger',
    });
    vi.mocked(formatUpdateMessage).mockReturnValue('');

    const result = await doctorCommand.execute([], makeContext());

    expect(result.message).not.toContain('Capabilities');
  });

  it('shows GitHub CLI authentication status', async () => {
    vi.mocked(loadConfig).mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    vi.mocked(findProvider).mockReturnValue(undefined);
    vi.mocked(checkForUpdate).mockResolvedValue({
      currentVersion: '0.8.0',
      latestVersion: '0.8.0',
      updateAvailable: false,
      updateCommand: 'npm install -g frogger',
    });
    vi.mocked(formatUpdateMessage).mockReturnValue('');

    // git --version → ok, gh --version → ok, gh auth status → ok
    vi.mocked(execa)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'git version 2.43', stderr: '' } as any) // git
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'pnpm 8.0', stderr: '' } as any) // pnpm
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'gh version 2.40', stderr: '' } as any) // gh --version
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any); // gh auth status

    const result = await doctorCommand.execute([], makeContext());

    expect(result.message).toContain('GitHub CLI');
    expect(result.message).toContain('authenticated');
  });

  it('shows GitHub CLI not authenticated', async () => {
    vi.mocked(loadConfig).mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    vi.mocked(findProvider).mockReturnValue(undefined);
    vi.mocked(checkForUpdate).mockResolvedValue({
      currentVersion: '0.8.0',
      latestVersion: '0.8.0',
      updateAvailable: false,
      updateCommand: 'npm install -g frogger',
    });
    vi.mocked(formatUpdateMessage).mockReturnValue('');

    vi.mocked(execa)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'git version 2.43', stderr: '' } as any)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'pnpm 8.0', stderr: '' } as any)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'gh version 2.40', stderr: '' } as any)
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: 'not logged in' } as any);

    const result = await doctorCommand.execute([], makeContext());

    expect(result.message).toContain('not authenticated');
  });

  it('handles update check failure gracefully', async () => {
    vi.mocked(loadConfig).mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    vi.mocked(findProvider).mockReturnValue(undefined);
    vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: 'v2.0', stderr: '' } as any);
    vi.mocked(checkForUpdate).mockRejectedValue(new Error('network error'));

    const result = await doctorCommand.execute([], makeContext());

    expect(result.message).toContain('could not check');
  });

  it('shows update available message', async () => {
    vi.mocked(loadConfig).mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
    vi.mocked(findProvider).mockReturnValue(undefined);
    vi.mocked(execa).mockResolvedValue({ exitCode: 0, stdout: 'v2.0', stderr: '' } as any);
    vi.mocked(checkForUpdate).mockResolvedValue({
      currentVersion: '0.7.0',
      latestVersion: '0.8.0',
      updateAvailable: true,
      updateCommand: 'npm install -g frogger',
    });
    vi.mocked(formatUpdateMessage).mockReturnValue('Update available: 0.7.0 → 0.8.0\nRun: npm install -g frogger');

    const result = await doctorCommand.execute([], makeContext());

    expect(result.message).toContain('0.7.0');
    expect(result.message).toContain('0.8.0');
    expect(result.message).toContain('available');
  });
});

// ==========================================================================
// /git-auth
// ==========================================================================
describe('gitAuthCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when "add" has insufficient args', async () => {
    const result = await gitAuthCommand.execute(['add', 'github.com'], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Usage: /git-auth add');
  });

  it('saves credential when "add" is given valid args', async () => {
    vi.mocked(loadGitCredentials).mockResolvedValue({ credentials: [] });
    vi.mocked(saveGitCredentials).mockResolvedValue(undefined);

    const result = await gitAuthCommand.execute(
      ['add', 'github.com', 'myuser', 'ghp_xxxx'],
      makeContext(),
    );

    expect(result.type).toBe('message');
    expect(result.message).toContain('Credential saved for github.com');
    expect(result.message).toContain('myuser');
    expect(saveGitCredentials).toHaveBeenCalledWith({
      credentials: [
        expect.objectContaining({
          host: 'github.com',
          username: 'myuser',
          token: 'ghp_xxxx',
        }),
      ],
    });
  });

  it('returns error when "remove" targets non-existent host', async () => {
    vi.mocked(loadGitCredentials).mockResolvedValue({ credentials: [] });

    const result = await gitAuthCommand.execute(
      ['remove', 'gitlab.com'],
      makeContext(),
    );

    expect(result.type).toBe('error');
    expect(result.message).toBe('No credential found for gitlab.com.');
  });

  it('shows auth status when called with no args', async () => {
    vi.mocked(detectGitAuthStatus).mockResolvedValue({
      ghCli: { available: true, authenticated: true, username: 'testuser' },
      ssh: { hasKeys: true, keyPaths: ['~/.ssh/id_ed25519'] },
      credentialHelper: { configured: true, helper: 'store' },
      froggerPat: { hasCredentials: true, hosts: ['github.com'] },
    });

    const result = await gitAuthCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('Git Authentication Status');
    expect(result.message).toContain('authenticated as testuser');
    expect(result.message).toContain('SSH keys found');
    expect(result.message).toContain('credential helper: store');
    expect(result.message).toContain('configured for github.com');
  });

  it('shows all-negative status when nothing configured', async () => {
    vi.mocked(detectGitAuthStatus).mockResolvedValue({
      ghCli: { available: false, authenticated: false },
      ssh: { hasKeys: false, keyPaths: [] },
      credentialHelper: { configured: false },
      froggerPat: { hasCredentials: false, hosts: [] },
    });

    const result = await gitAuthCommand.execute([], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('not installed');
    expect(result.message).toContain('none found');
    expect(result.message).toContain('not configured');
    expect(result.message).toContain('none configured');
  });

  it('removes existing credential', async () => {
    vi.mocked(loadGitCredentials).mockResolvedValue({
      credentials: [{ host: 'github.com', username: 'user1', token: 'ghp_xxx', createdAt: '2025-01-01' }],
    });
    vi.mocked(saveGitCredentials).mockResolvedValue(undefined);

    const result = await gitAuthCommand.execute(['remove', 'github.com'], makeContext());

    expect(result.type).toBe('message');
    expect(result.message).toContain('Credential removed for github.com');
    expect(saveGitCredentials).toHaveBeenCalledWith({ credentials: [] });
  });

  it('returns error when "remove" called with no host arg', async () => {
    const result = await gitAuthCommand.execute(['remove'], makeContext());

    expect(result.type).toBe('error');
    expect(result.message).toContain('Usage: /git-auth remove');
  });

  it('updates existing credential when host already exists', async () => {
    vi.mocked(loadGitCredentials).mockResolvedValue({
      credentials: [{ host: 'github.com', username: 'olduser', token: 'ghp_old', createdAt: '2025-01-01' }],
    });
    vi.mocked(saveGitCredentials).mockResolvedValue(undefined);

    const result = await gitAuthCommand.execute(
      ['add', 'github.com', 'newuser', 'ghp_new'],
      makeContext(),
    );

    expect(result.type).toBe('message');
    expect(result.message).toContain('Credential saved for github.com');
    expect(result.message).toContain('newuser');
    expect(saveGitCredentials).toHaveBeenCalledWith({
      credentials: [expect.objectContaining({
        host: 'github.com',
        username: 'newuser',
        token: 'ghp_new',
      })],
    });
  });
});
