import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tool } from 'ai';
import { z } from 'zod';
import { ToolRegistry } from '../registry.js';
import type { ToolMetadata } from '@frogger/shared';

// Mock the permission/rules module
vi.mock('../../permission/rules.js', () => ({
  resolvePermission: vi.fn(),
  buildPermissionRule: vi.fn(),
  savePermissionRule: vi.fn(),
  getProjectPermissionsPath: vi.fn(),
  getGlobalPermissionsPath: vi.fn(),
}));

// Mock the logger to suppress output during tests
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  resolvePermission,
  buildPermissionRule,
  savePermissionRule,
  getProjectPermissionsPath,
  getGlobalPermissionsPath,
} from '../../permission/rules.js';

const mockResolvePermission = vi.mocked(resolvePermission);
const mockBuildPermissionRule = vi.mocked(buildPermissionRule);
const mockSavePermissionRule = vi.mocked(savePermissionRule);
const mockGetProjectPermissionsPath = vi.mocked(getProjectPermissionsPath);
const mockGetGlobalPermissionsPath = vi.mocked(getGlobalPermissionsPath);

function makeDummyTool(desc: string, executeFn?: (args: Record<string, unknown>) => Promise<string>) {
  return tool({
    description: desc,
    inputSchema: z.object({ input: z.string().describe('test input') }),
    execute: executeFn ?? (async () => 'ok'),
  });
}

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = new ToolRegistry();
    const t = makeDummyTool('test tool');
    const meta: ToolMetadata = {
      name: 'test',
      description: 'test tool',
      permissionLevel: 'auto',
    };

    registry.register('test', t, meta);

    const tools = registry.getTools();
    expect(tools).toHaveProperty('test');
    expect(registry.getMetadata('test')).toEqual(meta);
  });

  it('filters tools by allowed names', () => {
    const registry = new ToolRegistry();
    registry.register('a', makeDummyTool('a'), {
      name: 'a',
      description: 'a',
      permissionLevel: 'auto',
    });
    registry.register('b', makeDummyTool('b'), {
      name: 'b',
      description: 'b',
      permissionLevel: 'confirm',
    });

    const filtered = registry.getTools(['a']);
    expect(Object.keys(filtered)).toEqual(['a']);
  });

  it('returns all tools when no filter', () => {
    const registry = new ToolRegistry();
    registry.register('x', makeDummyTool('x'), {
      name: 'x',
      description: 'x',
      permissionLevel: 'auto',
    });
    registry.register('y', makeDummyTool('y'), {
      name: 'y',
      description: 'y',
      permissionLevel: 'auto',
    });

    expect(Object.keys(registry.getTools())).toEqual(['x', 'y']);
  });

  it('returns undefined for unknown metadata', () => {
    const registry = new ToolRegistry();
    expect(registry.getMetadata('nonexistent')).toBeUndefined();
  });

  it('returns all metadata', () => {
    const registry = new ToolRegistry();
    registry.register('a', makeDummyTool('a'), {
      name: 'a',
      description: 'a',
      permissionLevel: 'auto',
    });
    registry.register('b', makeDummyTool('b'), {
      name: 'b',
      description: 'b',
      permissionLevel: 'confirm',
    });

    expect(registry.getAllMetadata()).toHaveLength(2);
  });
});

describe('getToolHints', () => {
  it('returns categorized markdown format', () => {
    const registry = new ToolRegistry();
    registry.register('read-file', makeDummyTool('read'), {
      name: 'read-file',
      description: 'Read a file',
      permissionLevel: 'auto',
      category: 'read',
      hints: 'Read files before editing.',
    });
    registry.register('write-file', makeDummyTool('write'), {
      name: 'write-file',
      description: 'Write a file',
      permissionLevel: 'confirm',
      category: 'write',
      hints: 'Use only for new files.',
    });

    const hints = registry.getToolHints();
    expect(hints).toContain('## Tool Usage Guide');
    expect(hints).toContain('### Reading');
    expect(hints).toContain('**read-file**: Read files before editing.');
    expect(hints).toContain('### Writing');
    expect(hints).toContain('**write-file**: Use only for new files.');
  });

  it('returns empty string for empty registry', () => {
    const registry = new ToolRegistry();
    expect(registry.getToolHints()).toBe('');
  });

  it('skips tools without hints or category', () => {
    const registry = new ToolRegistry();
    registry.register('test', makeDummyTool('test'), {
      name: 'test',
      description: 'test',
      permissionLevel: 'auto',
      // no hints or category
    });

    expect(registry.getToolHints()).toBe('');
  });

  it('groups tools by category in correct order', () => {
    const registry = new ToolRegistry();
    registry.register('bash', makeDummyTool('bash'), {
      name: 'bash',
      description: 'bash',
      permissionLevel: 'confirm',
      category: 'system',
      hints: 'System tool.',
    });
    registry.register('read-file', makeDummyTool('read'), {
      name: 'read-file',
      description: 'read',
      permissionLevel: 'auto',
      category: 'read',
      hints: 'Read tool.',
    });

    const hints = registry.getToolHints();
    // Reading section should come before System section
    const readIndex = hints.indexOf('### Reading');
    const systemIndex = hints.indexOf('### System');
    expect(readIndex).toBeLessThan(systemIndex);
  });
});

describe('getToolsWithPermission', () => {
  let registry: ToolRegistry;
  const dummyCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ToolRegistry();
    // Default mock returns for permission paths
    mockGetProjectPermissionsPath.mockReturnValue('/tmp/test-project/.frogger/permissions.json');
    mockGetGlobalPermissionsPath.mockReturnValue('/tmp/global/.frogger/permissions.json');
    // Default: no persisted rules match
    mockResolvePermission.mockReturnValue(null);
    // Default buildPermissionRule returns tool name
    mockBuildPermissionRule.mockImplementation((toolName: string) => toolName);
  });

  it('auto policy: tool executes without permission callback', async () => {
    const executeFn = vi.fn(async () => 'auto-result');
    registry.register('read-file', makeDummyTool('read', executeFn), {
      name: 'read-file',
      description: 'read',
      permissionLevel: 'auto',
    });

    const tools = registry.getToolsWithPermission(
      ['read-file'],
      'auto',
      dummyCallback,
    );

    expect(tools).toHaveProperty('read-file');

    // Execute the tool and verify no callback was invoked
    const wrapped = tools['read-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'test' }, {});
    expect(result).toBe('auto-result');
    expect(dummyCallback).not.toHaveBeenCalled();
  });

  it('auto policy with onBeforeExecute hook: hook is called before execution', async () => {
    const callOrder: string[] = [];
    const executeFn = vi.fn(async () => {
      callOrder.push('execute');
      return 'result';
    });
    const onBeforeExecute = vi.fn(async () => {
      callOrder.push('beforeExecute');
    });

    registry.register('read-file', makeDummyTool('read', executeFn), {
      name: 'read-file',
      description: 'read',
      permissionLevel: 'auto',
    });

    const tools = registry.getToolsWithPermission(
      ['read-file'],
      'auto',
      dummyCallback,
      undefined,
      onBeforeExecute,
    );

    const wrapped = tools['read-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'hello' }, {});

    expect(result).toBe('result');
    expect(onBeforeExecute).toHaveBeenCalledWith('read-file', { input: 'hello' });
    expect(dummyCallback).not.toHaveBeenCalled();
    expect(callOrder).toEqual(['beforeExecute', 'execute']);
  });

  it('confirm-writes policy: permission callback is called for write tools', async () => {
    dummyCallback.mockResolvedValue('allow');
    const executeFn = vi.fn(async () => 'write-result');

    registry.register('write-file', makeDummyTool('write', executeFn), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    await wrapped.execute({ input: 'data' }, {});

    expect(dummyCallback).toHaveBeenCalledWith('write-file', { input: 'data' });
  });

  it('confirm-writes policy: tool executes after allow response', async () => {
    dummyCallback.mockResolvedValue('allow');
    const executeFn = vi.fn(async () => 'write-result');

    registry.register('write-file', makeDummyTool('write', executeFn), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'data' }, {});

    expect(result).toBe('write-result');
    expect(executeFn).toHaveBeenCalled();
  });

  it('confirm-writes policy: tool returns denial message after deny response', async () => {
    dummyCallback.mockResolvedValue('deny');
    const executeFn = vi.fn(async () => 'should-not-reach');

    registry.register('write-file', makeDummyTool('write', executeFn), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'data' }, {});

    expect(result).toBe('Tool execution denied by user.');
    expect(executeFn).not.toHaveBeenCalled();
  });

  it('confirm-writes policy with persisted always-project rule: bypasses callback', async () => {
    // Simulate persisted rule match
    mockResolvePermission.mockReturnValue('allow');
    const executeFn = vi.fn(async () => 'persisted-result');

    registry.register('write-file', makeDummyTool('write', executeFn), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      '/tmp/test-project',
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'data' }, {});

    expect(result).toBe('persisted-result');
    expect(dummyCallback).not.toHaveBeenCalled();
    expect(mockResolvePermission).toHaveBeenCalledWith('write-file', { input: 'data' }, '/tmp/test-project');
  });

  it('always-project response triggers savePermissionRule', async () => {
    dummyCallback.mockResolvedValue('always-project');
    mockBuildPermissionRule.mockReturnValue('write-file');

    registry.register('write-file', makeDummyTool('write'), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      '/tmp/test-project',
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    await wrapped.execute({ input: 'data' }, {});

    expect(mockBuildPermissionRule).toHaveBeenCalledWith('write-file', { input: 'data' });
    expect(mockSavePermissionRule).toHaveBeenCalledWith(
      '/tmp/test-project/.frogger/permissions.json',
      'allow',
      'write-file',
    );
  });

  it('always-global response triggers savePermissionRule', async () => {
    dummyCallback.mockResolvedValue('always-global');
    mockBuildPermissionRule.mockReturnValue('write-file');

    registry.register('write-file', makeDummyTool('write'), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      '/tmp/test-project',
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    await wrapped.execute({ input: 'data' }, {});

    expect(mockBuildPermissionRule).toHaveBeenCalledWith('write-file', { input: 'data' });
    expect(mockSavePermissionRule).toHaveBeenCalledWith(
      '/tmp/global/.frogger/permissions.json',
      'allow',
      'write-file',
    );
  });

  it('onBeforeExecute hook called before tool execute in confirm mode', async () => {
    const callOrder: string[] = [];
    dummyCallback.mockResolvedValue('allow');
    const executeFn = vi.fn(async () => {
      callOrder.push('execute');
      return 'result';
    });
    const onBeforeExecute = vi.fn(async () => {
      callOrder.push('beforeExecute');
    });

    registry.register('write-file', makeDummyTool('write', executeFn), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      undefined,
      onBeforeExecute,
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'test' }, {});

    expect(result).toBe('result');
    expect(onBeforeExecute).toHaveBeenCalledWith('write-file', { input: 'test' });
    expect(callOrder).toEqual(['beforeExecute', 'execute']);
  });

  it('deny-project response saves deny rule to project permissions', async () => {
    dummyCallback.mockResolvedValue('deny-project');
    mockBuildPermissionRule.mockReturnValue('write-file');

    registry.register('write-file', makeDummyTool('write'), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      '/tmp/test-project',
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'data' }, {});

    expect(result).toBe('Tool execution denied by user (saved to project rules).');
    expect(mockBuildPermissionRule).toHaveBeenCalledWith('write-file', { input: 'data' });
    expect(mockSavePermissionRule).toHaveBeenCalledWith(
      '/tmp/test-project/.frogger/permissions.json',
      'deny',
      'write-file',
    );
  });

  it('deny-global response saves deny rule to global permissions', async () => {
    dummyCallback.mockResolvedValue('deny-global');
    mockBuildPermissionRule.mockReturnValue('write-file');

    registry.register('write-file', makeDummyTool('write'), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['write-file'],
      'confirm-writes',
      dummyCallback,
      '/tmp/test-project',
    );

    const wrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const result = await wrapped.execute({ input: 'data' }, {});

    expect(result).toBe('Tool execution denied by user (saved to global rules).');
    expect(mockBuildPermissionRule).toHaveBeenCalledWith('write-file', { input: 'data' });
    expect(mockSavePermissionRule).toHaveBeenCalledWith(
      '/tmp/global/.frogger/permissions.json',
      'deny',
      'write-file',
    );
  });

  it('multiple tools wrapped independently', async () => {
    const readExecute = vi.fn(async () => 'read-result');
    const writeExecute = vi.fn(async () => 'write-result');
    dummyCallback.mockResolvedValue('allow');

    registry.register('read-file', makeDummyTool('read', readExecute), {
      name: 'read-file',
      description: 'read',
      permissionLevel: 'auto',
    });
    registry.register('write-file', makeDummyTool('write', writeExecute), {
      name: 'write-file',
      description: 'write',
      permissionLevel: 'confirm',
    });

    const tools = registry.getToolsWithPermission(
      ['read-file', 'write-file'],
      'confirm-writes',
      dummyCallback,
    );

    // Both tools should be present
    expect(Object.keys(tools)).toEqual(['read-file', 'write-file']);

    // read-file (auto permission) should execute without callback
    const readWrapped = tools['read-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const readResult = await readWrapped.execute({ input: 'r' }, {});
    expect(readResult).toBe('read-result');
    expect(dummyCallback).not.toHaveBeenCalled();

    // write-file (confirm permission) should invoke callback
    const writeWrapped = tools['write-file'] as unknown as { execute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> };
    const writeResult = await writeWrapped.execute({ input: 'w' }, {});
    expect(writeResult).toBe('write-result');
    expect(dummyCallback).toHaveBeenCalledWith('write-file', { input: 'w' });
  });
});
