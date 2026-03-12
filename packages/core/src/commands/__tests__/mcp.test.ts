import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpCommand } from '../mcp.js';
import type { SlashCommandContext } from '../types.js';

vi.mock('../../mcp/index.js', () => ({
  loadMCPConfig: vi.fn(),
}));

import { loadMCPConfig } from '../../mcp/index.js';

const mockLoadMCPConfig = vi.mocked(loadMCPConfig);

const mockContext = {
  messagesRef: { current: [] },
} as unknown as SlashCommandContext;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mcpCommand (/mcp)', () => {
  it('has correct name and description', () => {
    expect(mcpCommand.name).toBe('mcp');
    expect(mcpCommand.description).toBeTruthy();
  });

  it('shows setup example when no servers configured', async () => {
    mockLoadMCPConfig.mockReturnValue({ servers: {} });

    const result = await mcpCommand.execute([], mockContext);
    expect(result.type).toBe('message');
    expect(result.message).toContain('No MCP servers configured');
    expect(result.message).toContain('.frogger/mcp.json');
  });

  it('lists stdio server with command and args', async () => {
    mockLoadMCPConfig.mockReturnValue({
      servers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
          env: {},
          enabled: true,
        },
      },
    });

    const result = await mcpCommand.execute([], mockContext);
    expect(result.type).toBe('message');
    expect(result.message).toContain('✓ filesystem');
    expect(result.message).toContain('npx -y @modelcontextprotocol/server-filesystem .');
    expect(result.message).toContain('1 enabled / 1 configured');
  });

  it('lists SSE and HTTP servers with transport URL', async () => {
    mockLoadMCPConfig.mockReturnValue({
      servers: {
        'remote-sse': {
          transport: 'sse',
          url: 'https://example.com/sse',
          headers: {},
          enabled: true,
        },
        'remote-http': {
          transport: 'http',
          url: 'https://example.com/mcp',
          headers: {},
          enabled: false,
        },
      },
    });

    const result = await mcpCommand.execute([], mockContext);
    expect(result.type).toBe('message');
    expect(result.message).toContain('✓ remote-sse — sse://https://example.com/sse');
    expect(result.message).toContain('✗ remote-http — http://https://example.com/mcp');
    expect(result.message).toContain('1 enabled / 2 configured');
  });

  it('returns error when reconnecting without mcpClientManager', async () => {
    const result = await mcpCommand.execute(['reconnect'], mockContext);
    expect(result.type).toBe('error');
    expect(result.message).toContain('not available');
  });

  it('shows message when all servers already connected', async () => {
    const ctx = {
      ...mockContext,
      mcpClientManager: {
        getDisconnectedServers: vi.fn().mockReturnValue([]),
      },
    } as unknown as SlashCommandContext;

    const result = await mcpCommand.execute(['reconnect'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('already connected');
  });

  it('shows reconnect results with success and failure counts', async () => {
    const ctx = {
      ...mockContext,
      mcpClientManager: {
        getDisconnectedServers: vi.fn().mockReturnValue(['server-a', 'server-b']),
        reconnectAll: vi.fn().mockResolvedValue([
          { name: 'server-a', success: true },
          { name: 'server-b', success: false, error: 'timeout' },
        ]),
      },
    } as unknown as SlashCommandContext;

    const result = await mcpCommand.execute(['reconnect'], ctx);
    expect(result.type).toBe('message');
    expect(result.message).toContain('✓ server-a — reconnected');
    expect(result.message).toContain('✗ server-b — failed: timeout');
    expect(result.message).toContain('1/2');
  });
});
