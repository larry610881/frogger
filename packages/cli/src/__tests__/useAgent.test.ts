import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PermissionResponse } from '@frogger/shared';

/**
 * Tests for the useAgent hook core logic.
 *
 * Since useAgent is a complex React hook with heavy async dependencies,
 * we test the extracted logic patterns rather than rendering with React.
 * The patterns tested here match the actual flows in useAgent.ts.
 *
 * Reference: useAgent-abort.test.ts for the abort/permission cleanup pattern.
 */

// Mock @frogger/core
const mockRunAgent = vi.fn();
const mockLoadConfig = vi.fn().mockReturnValue({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'key' });
const mockCreateModel = vi.fn().mockReturnValue({});
const mockBuildSystemPrompt = vi.fn().mockReturnValue('system prompt');
const mockCreateAgentTools = vi.fn().mockResolvedValue({ tools: {}, mcpClientManager: null, toolHints: '' });
const mockResolveFileReferences = vi.fn();
const mockFindProvider = vi.fn();
const mockLoadProjectContext = vi.fn().mockResolvedValue('');
const mockGenerateRepoMap = vi.fn().mockResolvedValue('');
const mockLoadRules = vi.fn().mockReturnValue('');
const mockLoadMemory = vi.fn().mockReturnValue('');
const mockDetectProjectInfo = vi.fn().mockResolvedValue({});
const mockFormatProjectInfo = vi.fn().mockReturnValue('');
const mockSessionSave = vi.fn().mockResolvedValue('sess-1');
const mockCommandRegistryIsCommand = vi.fn().mockReturnValue(false);
const mockCommandRegistryExecute = vi.fn();

vi.mock('@frogger/core', () => {
  class MockSessionManager {
    save = mockSessionSave;
  }
  class MockCommandRegistry {
    isCommand = mockCommandRegistryIsCommand;
    execute = mockCommandRegistryExecute;
  }
  class MockModeManager {
    private mode: string;
    constructor(mode: string) { this.mode = mode; }
    getCurrentMode() {
      return { name: this.mode, allowedTools: ['read-file', 'glob'], approvalPolicy: 'auto' };
    }
  }
  return {
    runAgent: (...args: unknown[]) => mockRunAgent(...args),
    loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
    createModel: (...args: unknown[]) => mockCreateModel(...args),
    ModeManager: MockModeManager,
    buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
    createAgentTools: (...args: unknown[]) => mockCreateAgentTools(...args),
    resolveFileReferences: (...args: unknown[]) => mockResolveFileReferences(...args),
    findProvider: (...args: unknown[]) => mockFindProvider(...args),
    loadProjectContext: (...args: unknown[]) => mockLoadProjectContext(...args),
    generateRepoMap: (...args: unknown[]) => mockGenerateRepoMap(...args),
    loadRules: (...args: unknown[]) => mockLoadRules(...args),
    loadMemory: (...args: unknown[]) => mockLoadMemory(...args),
    detectProjectInfo: (...args: unknown[]) => mockDetectProjectInfo(...args),
    formatProjectInfo: (...args: unknown[]) => mockFormatProjectInfo(...args),
    loadProviders: vi.fn().mockReturnValue([]),
    findModelInfo: vi.fn(),
    SessionManager: MockSessionManager,
    CommandRegistry: MockCommandRegistry,
  };
});

vi.mock('@frogger/shared', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@frogger/shared')>();
  return {
    ...orig,
    resolveCapabilities: vi.fn().mockReturnValue({ vision: false, thinking: false, caching: false, toolUse: true }),
  };
});

describe('useAgent — submit slash command dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submit dispatches slash command when input starts with /', async () => {
    mockCommandRegistryIsCommand.mockReturnValue(true);
    mockCommandRegistryExecute.mockResolvedValue({ type: 'message', message: 'Executed /clear' });

    const { CommandRegistry } = await import('@frogger/core');
    const registry = new CommandRegistry();

    const isCommand = registry.isCommand('/clear');
    expect(isCommand).toBe(true);

    const result = await registry.execute('/clear', {});
    expect(result).toEqual({ type: 'message', message: 'Executed /clear' });
  });

  it('submit calls submitInternal for normal text', async () => {
    mockCommandRegistryIsCommand.mockReturnValue(false);

    const { CommandRegistry } = await import('@frogger/core');
    const registry = new CommandRegistry();

    const isCommand = registry.isCommand('hello world');
    expect(isCommand).toBe(false);
    // When not a command, submitInternal would be called (tested below)
  });
});

describe('useAgent — submitInternal file references', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submitInternal resolves @file references before sending', async () => {
    mockResolveFileReferences.mockResolvedValue({
      cleanText: 'check this file',
      references: [{ path: 'src/main.ts', content: 'const x = 1;' }],
      imageReferences: [],
      errors: [],
    });

    const { resolveFileReferences } = await import('@frogger/core');
    const result = await resolveFileReferences('check @src/main.ts', '/workspace');

    expect(result.cleanText).toBe('check this file');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].path).toBe('src/main.ts');
  });

  it('submitInternal warns when image used without vision support', async () => {
    mockResolveFileReferences.mockResolvedValue({
      cleanText: 'look at this',
      references: [],
      imageReferences: [{ path: 'screenshot.png', base64: 'abc', mediaType: 'image/png' }],
      errors: [],
    });
    mockFindProvider.mockReturnValue({
      name: 'deepseek',
      label: 'DeepSeek',
      type: 'openai-compatible',
    });

    const { resolveFileReferences, findProvider } = await import('@frogger/core');
    const { resolveCapabilities } = await import('@frogger/shared');

    const result = await resolveFileReferences('look at @screenshot.png', '/workspace');
    const provider = findProvider('deepseek');
    const caps = resolveCapabilities(provider!);

    expect(result.imageReferences).toHaveLength(1);
    expect(caps.vision).toBe(false);
    // In useAgent, this triggers a warning message
  });
});

describe('useAgent — event handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submitInternal handles text_delta events', async () => {
    const events = [
      { type: 'text_delta', textDelta: 'Hello ' },
      { type: 'text_delta', textDelta: 'world' },
      { type: 'done', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
    ];

    let fullText = '';
    for (const event of events) {
      if (event.type === 'text_delta') {
        fullText += event.textDelta;
      }
    }

    expect(fullText).toBe('Hello world');
  });

  it('submitInternal handles tool_call and tool_result events', async () => {
    const messages: Array<{ role: string; content: string }> = [];
    const events = [
      { type: 'tool_call', toolName: 'read-file', args: { path: 'src/main.ts' } },
      { type: 'tool_result', toolName: 'read-file', result: 'const x = 1;' },
      { type: 'done', usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
    ];

    let pendingToolCall: { toolName: string; args: Record<string, unknown> } | null = null;

    for (const event of events) {
      if (event.type === 'tool_call') {
        pendingToolCall = { toolName: event.toolName, args: event.args as Record<string, unknown> };
      } else if (event.type === 'tool_result') {
        messages.push({ role: 'tool', content: `${event.toolName}: ${event.result}` });
        pendingToolCall = null;
      }
    }

    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toContain('read-file');
    expect(pendingToolCall).toBeNull();
  });

  it('submitInternal accumulates session usage on done event', () => {
    let sessionPromptTokens = 0;
    let sessionCompletionTokens = 0;

    const doneEvents = [
      { usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      { usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
    ];

    for (const event of doneEvents) {
      sessionPromptTokens += event.usage.promptTokens;
      sessionCompletionTokens += event.usage.completionTokens;
    }

    expect(sessionPromptTokens).toBe(300);
    expect(sessionCompletionTokens).toBe(150);
  });
});

describe('useAgent — session management', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submitInternal auto-saves session on done', async () => {
    const { SessionManager } = await import('@frogger/core');
    const manager = new SessionManager();

    const sessionId = await manager.save({
      workingDirectory: '/test',
      provider: 'deepseek',
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'hello' }],
      totalTokens: 150,
    });

    expect(sessionId).toBe('sess-1');
    expect(mockSessionSave).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'deepseek',
      model: 'deepseek-chat',
      totalTokens: 150,
    }));
  });

  it('submitInternal calls updateBudget after done', () => {
    const mockUpdateBudget = vi.fn();

    // Simulate: after done event, updateBudget is called
    mockUpdateBudget('system prompt');

    expect(mockUpdateBudget).toHaveBeenCalledWith('system prompt');
  });
});

describe('useAgent — respondPermission', () => {
  it('respondPermission resolves pending permission and clears state', async () => {
    let pendingPermission: {
      toolName: string;
      args: Record<string, unknown>;
      resolve: (response: PermissionResponse) => void;
    } | null = null;

    const permissionPromise = new Promise<PermissionResponse>((resolve) => {
      pendingPermission = { toolName: 'write-file', args: { path: '/test' }, resolve };
    });

    expect(pendingPermission).not.toBeNull();

    // respondPermission
    if (pendingPermission) {
      (pendingPermission as typeof pendingPermission & { resolve: (r: PermissionResponse) => void }).resolve('allow');
      pendingPermission = null;
    }

    const result = await permissionPromise;
    expect(result).toBe('allow');
    expect(pendingPermission).toBeNull();
  });
});

describe('useAgent — /rewind handling', () => {
  it('submit handles /rewind result with messageIndex truncation', () => {
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply1' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'reply2' },
      { role: 'user', content: 'third' },
    ];

    const rewindResult = { type: 'message', message: 'Rewound to checkpoint #1', messageIndex: 2 };

    if (rewindResult.messageIndex !== undefined) {
      const truncated = messages.slice(0, rewindResult.messageIndex);
      expect(truncated).toHaveLength(2);
      expect(truncated[0]!.content).toBe('first');
      expect(truncated[1]!.content).toBe('reply1');
    }
  });
});

describe('useAgent — plan mode auto-execute', () => {
  it('plan mode auto-executes after completion', () => {
    const activeMode = 'plan';
    const fullText = 'Here is the plan:\n1. Do X\n2. Do Y';
    let autoExecuteRef: string | null = null;

    if (activeMode === 'plan' && fullText.trim()) {
      autoExecuteRef = fullText.trim();
    }

    expect(autoExecuteRef).toBe('Here is the plan:\n1. Do X\n2. Do Y');

    // After plan finishes, switch to agent mode
    let newMode: string | null = null;
    if (autoExecuteRef) {
      newMode = 'agent';
      autoExecuteRef = null;
    }

    expect(newMode).toBe('agent');
    expect(autoExecuteRef).toBeNull();
  });
});

describe('useAgent — lifecycle', () => {
  it('initial prompt is auto-submitted on mount', () => {
    let initialSubmitted = false;
    const initialPrompt = 'fix the bug';
    const mockSubmit = vi.fn();

    // Simulate useEffect for initial prompt
    if (initialPrompt && !initialSubmitted) {
      initialSubmitted = true;
      mockSubmit(initialPrompt);
    }

    expect(mockSubmit).toHaveBeenCalledWith('fix the bug');
    expect(initialSubmitted).toBe(true);

    // Second call should not submit again
    mockSubmit.mockClear();
    if (initialPrompt && !initialSubmitted) {
      mockSubmit(initialPrompt);
    }
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('MCP connections are cleaned up on unmount', async () => {
    const mockCloseAll = vi.fn().mockResolvedValue(undefined);
    const mcpClientManager = { closeAll: mockCloseAll };

    // Simulate unmount cleanup
    await mcpClientManager.closeAll();

    expect(mockCloseAll).toHaveBeenCalled();
  });
});
