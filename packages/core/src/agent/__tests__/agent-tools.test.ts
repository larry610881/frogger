const {
  mockGetToolsWithPermission,
  mockCreateToolRegistry,
  mockDetectGitRepo,
  mockCreateCheckpoint,
} = vi.hoisted(() => {
  const mockGetToolsWithPermission = vi.fn().mockReturnValue({ 'read-file': {} });
  const mockCreateToolRegistry = vi.fn().mockReturnValue({
    getToolsWithPermission: mockGetToolsWithPermission,
  });
  const mockDetectGitRepo = vi.fn().mockResolvedValue(true);
  const mockCreateCheckpoint = vi.fn().mockResolvedValue(null);
  return { mockGetToolsWithPermission, mockCreateToolRegistry, mockDetectGitRepo, mockCreateCheckpoint };
});

vi.mock('../../tools/index.js', () => ({
  createToolRegistry: mockCreateToolRegistry,
}));

vi.mock('../checkpoint.js', () => {
  class MockCheckpointManager {
    createCheckpoint = mockCreateCheckpoint;
    static detectGitRepo = mockDetectGitRepo;
    constructor(...args: unknown[]) {
      // Track constructor calls for assertions
      MockCheckpointManager._constructorCalls.push(args);
    }
    static _constructorCalls: unknown[][] = [];
  }
  return { CheckpointManager: MockCheckpointManager };
});

import { CheckpointManager } from '../checkpoint.js';
import { createAgentTools } from '../agent-tools.js';
import type { CreateAgentToolsOptions } from '../agent-tools.js';
import type { ApprovalPolicy } from '@frogger/shared';

// Helper to access mock constructor calls
const getMockConstructorCalls = () => (CheckpointManager as any)._constructorCalls as unknown[][];
const clearMockConstructorCalls = () => { (CheckpointManager as any)._constructorCalls = []; };

function makeOptions(overrides?: Partial<CreateAgentToolsOptions>): CreateAgentToolsOptions {
  return {
    workingDirectory: '/tmp/test-project',
    allowedTools: ['read-file', 'write-file'],
    policy: 'confirm-writes' as ApprovalPolicy,
    permissionCallback: vi.fn().mockResolvedValue({ allowed: true }),
    ...overrides,
  };
}

describe('createAgentTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockConstructorCalls();
    // Restore default return values after clearAllMocks
    mockGetToolsWithPermission.mockReturnValue({ 'read-file': {} });
    mockCreateToolRegistry.mockReturnValue({
      getToolsWithPermission: mockGetToolsWithPermission,
    });
    mockDetectGitRepo.mockResolvedValue(true);
    mockCreateCheckpoint.mockResolvedValue(null);
  });

  it('returns null checkpointManager when enableCheckpoints is false', async () => {
    const result = await createAgentTools(makeOptions({ enableCheckpoints: false }));

    expect(result.checkpointManager).toBeNull();
    expect(mockDetectGitRepo).not.toHaveBeenCalled();
    expect(getMockConstructorCalls()).toHaveLength(0);
  });

  it('does not pass onBeforeExecute when enableCheckpoints is false', async () => {
    await createAgentTools(makeOptions({ enableCheckpoints: false }));

    expect(mockGetToolsWithPermission).toHaveBeenCalledWith(
      ['read-file', 'write-file'],
      'confirm-writes',
      expect.any(Function),
      '/tmp/test-project',
      undefined,
    );
  });

  it('creates a new CheckpointManager when enableCheckpoints is true (default) and none provided', async () => {
    const result = await createAgentTools(makeOptions());

    expect(mockDetectGitRepo).toHaveBeenCalledWith('/tmp/test-project');
    expect(getMockConstructorCalls()).toHaveLength(1);
    expect(getMockConstructorCalls()[0]![0]).toEqual({
      workingDirectory: '/tmp/test-project',
      isGitRepo: true,
    });
    expect(result.checkpointManager).not.toBeNull();
  });

  it('reuses existingCheckpointManager and does not call detectGitRepo', async () => {
    const existingManager = { createCheckpoint: mockCreateCheckpoint } as unknown as CheckpointManager;

    const result = await createAgentTools(makeOptions({
      existingCheckpointManager: existingManager,
    }));

    expect(mockDetectGitRepo).not.toHaveBeenCalled();
    expect(getMockConstructorCalls()).toHaveLength(0);
    expect(result.checkpointManager).toBe(existingManager);
  });

  it('calls getToolsWithPermission with correct arguments', async () => {
    const callback = vi.fn().mockResolvedValue({ allowed: true });

    await createAgentTools(makeOptions({
      allowedTools: ['read-file', 'glob'],
      policy: 'auto' as ApprovalPolicy,
      permissionCallback: callback,
    }));

    expect(mockGetToolsWithPermission).toHaveBeenCalledWith(
      ['read-file', 'glob'],
      'auto',
      callback,
      '/tmp/test-project',
      expect.any(Function), // onBeforeExecute
    );
  });

  it('onBeforeExecute calls createCheckpoint with correct toolName, args, and messageIndex', async () => {
    const getMessageCount = vi.fn().mockReturnValue(5);

    await createAgentTools(makeOptions({ getMessageCount }));

    // Extract the onBeforeExecute callback that was passed to getToolsWithPermission
    const onBeforeExecute = mockGetToolsWithPermission.mock.calls[0]![4] as (
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<void>;

    expect(onBeforeExecute).toBeDefined();

    await onBeforeExecute('write-file', { path: 'test.txt' });

    expect(mockCreateCheckpoint).toHaveBeenCalledWith(
      'write-file',
      { path: 'test.txt' },
      5,
    );
    expect(getMessageCount).toHaveBeenCalled();
  });

  it('defaults messageIndex to 0 when getMessageCount is not provided', async () => {
    await createAgentTools(makeOptions());

    const onBeforeExecute = mockGetToolsWithPermission.mock.calls[0]![4] as (
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<void>;

    await onBeforeExecute('bash', { command: 'ls' });

    expect(mockCreateCheckpoint).toHaveBeenCalledWith(
      'bash',
      { command: 'ls' },
      0,
    );
  });

  it('uses getMessageCount return value when provided', async () => {
    const getMessageCount = vi.fn()
      .mockReturnValueOnce(3)
      .mockReturnValueOnce(7);

    await createAgentTools(makeOptions({ getMessageCount }));

    const onBeforeExecute = mockGetToolsWithPermission.mock.calls[0]![4] as (
      toolName: string,
      args: Record<string, unknown>,
    ) => Promise<void>;

    await onBeforeExecute('write-file', { path: 'a.txt' });
    expect(mockCreateCheckpoint).toHaveBeenCalledWith('write-file', { path: 'a.txt' }, 3);

    await onBeforeExecute('edit-file', { path: 'b.txt' });
    expect(mockCreateCheckpoint).toHaveBeenCalledWith('edit-file', { path: 'b.txt' }, 7);
  });
});
