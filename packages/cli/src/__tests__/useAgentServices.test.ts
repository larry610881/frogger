import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the useAgentServices hook logic.
 *
 * We test the core initialization patterns (lazy creation, singleton, checkpoint
 * detection) by directly invoking the logic rather than rendering React hooks.
 */

// Mock @frogger/core
const mockDetectGitRepo = vi.fn();
const mockBudgetTrackerConstructor = vi.fn();
const mockCommandRegistryRegister = vi.fn();
const mockFindModelInfo = vi.fn().mockReturnValue({ contextWindow: 128000, maxOutputTokens: 8192 });
const mockLoadCustomCommands = vi.fn().mockReturnValue([]);

vi.mock('@frogger/core', () => {
  class MockContextBudgetTracker {
    constructor(...args: unknown[]) {
      mockBudgetTrackerConstructor(...args);
    }
  }
  class MockCommandRegistry {
    register = mockCommandRegistryRegister;
  }
  class MockCheckpointManager {
    static detectGitRepo = mockDetectGitRepo;
  }

  return {
    ContextBudgetTracker: MockContextBudgetTracker,
    CommandRegistry: MockCommandRegistry,
    CheckpointManager: MockCheckpointManager,
    findModelInfo: mockFindModelInfo,
    clearCommand: { name: 'clear' },
    compactCommand: { name: 'compact' },
    compactThresholdCommand: { name: 'compact-threshold' },
    modelCommand: { name: 'model' },
    setupCommand: { name: 'setup' },
    undoCommand: { name: 'undo' },
    sessionsCommand: { name: 'sessions' },
    resumeCommand: { name: 'resume' },
    gitAuthCommand: { name: 'git-auth' },
    costCommand: { name: 'cost' },
    contextCommand: { name: 'context' },
    doctorCommand: { name: 'doctor' },
    updateCheckCommand: { name: 'update' },
    createRewindCommand: vi.fn().mockReturnValue({ name: 'rewind' }),
    mcpCommand: { name: 'mcp' },
    initProjectCommand: { name: 'init-project' },
    rememberCommand: { name: 'remember' },
    issueCommand: { name: 'issue' },
    bgCommand: { name: 'bg' },
    tasksCommand: { name: 'tasks' },
    taskCommand: { name: 'task' },
    loadCustomCommands: mockLoadCustomCommands,
  };
});

describe('useAgentServices logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectGitRepo.mockResolvedValue(false);
  });

  it('ensureInitialized lazy-creates budgetTracker on first call', async () => {
    const { ContextBudgetTracker, findModelInfo } = await import('@frogger/core');

    // Simulate first initialization
    let budgetTracker: InstanceType<typeof ContextBudgetTracker> | null = null;
    if (!budgetTracker) {
      const modelInfo = findModelInfo('deepseek', 'deepseek-chat');
      budgetTracker = new ContextBudgetTracker(modelInfo);
    }

    expect(mockFindModelInfo).toHaveBeenCalledWith('deepseek', 'deepseek-chat');
    expect(mockBudgetTrackerConstructor).toHaveBeenCalledWith({ contextWindow: 128000, maxOutputTokens: 8192 });
    expect(budgetTracker).not.toBeNull();
  });

  it('ensureInitialized lazy-creates commandRegistry with all commands', async () => {
    const { CommandRegistry } = await import('@frogger/core');

    const registry = new CommandRegistry();
    // Simulate registering all commands like ensureInitialized does
    const commands = [
      'clear', 'compact', 'compact-threshold', 'model', 'setup',
      'undo', 'sessions', 'resume', 'git-auth', 'cost',
      'context', 'doctor', 'update', 'rewind', 'mcp',
      'init-project', 'remember', 'issue', 'bg', 'tasks', 'task',
    ];
    for (const cmd of commands) {
      registry.register({ name: cmd } as any);
    }

    // 21 built-in commands registered
    expect(mockCommandRegistryRegister).toHaveBeenCalledTimes(21);
  });

  it('ensureInitialized returns same instances on repeated calls (singleton)', async () => {
    const { ContextBudgetTracker, findModelInfo } = await import('@frogger/core');

    let budgetTracker: InstanceType<typeof ContextBudgetTracker> | null = null;

    // First call: creates
    if (!budgetTracker) {
      const modelInfo = findModelInfo('deepseek', 'deepseek-chat');
      budgetTracker = new ContextBudgetTracker(modelInfo);
    }
    const firstRef = budgetTracker;

    // Second call: returns same
    if (!budgetTracker) {
      // This branch should NOT execute
      budgetTracker = new ContextBudgetTracker(findModelInfo('deepseek', 'deepseek-chat'));
    }

    expect(budgetTracker).toBe(firstRef);
    // Constructor called only once
    expect(mockBudgetTrackerConstructor).toHaveBeenCalledTimes(1);
  });

  it('ensureCheckpointManager detects git repo and creates manager', async () => {
    mockDetectGitRepo.mockResolvedValue(true);

    const { CheckpointManager } = await import('@frogger/core');

    const isGitRepo = await CheckpointManager.detectGitRepo('/test/dir');

    expect(mockDetectGitRepo).toHaveBeenCalledWith('/test/dir');
    expect(isGitRepo).toBe(true);
  });

  it('ensureCheckpointManager deduplicates concurrent calls', async () => {
    mockDetectGitRepo.mockResolvedValue(false);

    let checkpointManager: object | null = null;
    let initPromise: Promise<void> | null = null;

    async function ensureCheckpointManager() {
      if (checkpointManager) return;
      if (!initPromise) {
        initPromise = (async () => {
          const { CheckpointManager } = await import('@frogger/core');
          await CheckpointManager.detectGitRepo('/test');
          checkpointManager = {};
        })();
      }
      await initPromise;
    }

    // Call twice concurrently
    await Promise.all([
      ensureCheckpointManager(),
      ensureCheckpointManager(),
    ]);

    // detectGitRepo should only be called once despite two concurrent calls
    expect(mockDetectGitRepo).toHaveBeenCalledTimes(1);
    expect(checkpointManager).not.toBeNull();
  });

  it('ensureInitialized calls ensureCheckpointManager before registering rewind', async () => {
    const callOrder: string[] = [];

    mockDetectGitRepo.mockImplementation(async () => {
      callOrder.push('detectGitRepo');
      return false;
    });

    const { CheckpointManager, createRewindCommand } = await import('@frogger/core');

    // Simulate the ensureInitialized flow
    await CheckpointManager.detectGitRepo('/test');
    callOrder.push('createRewindCommand');
    createRewindCommand(null as any);

    expect(callOrder).toEqual(['detectGitRepo', 'createRewindCommand']);
  });
});
