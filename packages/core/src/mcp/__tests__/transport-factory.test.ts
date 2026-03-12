import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTransportType, createTransport } from '../transport-factory.js';
import type { MCPStdioConfig, MCPSSEConfig, MCPHTTPConfig } from '../config.js';

// Mock all transport modules
vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'stdio';
  }),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'sse';
  }),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.type = 'http';
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getTransportType', () => {
  it('returns stdio for config without transport field', () => {
    const config: MCPStdioConfig = { command: 'echo', args: [], env: {}, enabled: true };
    expect(getTransportType(config)).toBe('stdio');
  });

  it('returns stdio for config with transport: "stdio"', () => {
    const config: MCPStdioConfig = { transport: 'stdio', command: 'echo', args: [], env: {}, enabled: true };
    expect(getTransportType(config)).toBe('stdio');
  });

  it('returns sse for SSE config', () => {
    const config: MCPSSEConfig = { transport: 'sse', url: 'https://example.com/sse', headers: {}, enabled: true };
    expect(getTransportType(config)).toBe('sse');
  });

  it('returns http for HTTP config', () => {
    const config: MCPHTTPConfig = { transport: 'http', url: 'https://example.com/mcp', headers: {}, enabled: true };
    expect(getTransportType(config)).toBe('http');
  });
});

describe('createTransport', () => {
  it('creates StdioClientTransport for stdio config', async () => {
    const config: MCPStdioConfig = { command: 'npx', args: ['server'], env: { KEY: 'val' }, enabled: true };
    const transport = await createTransport(config);
    expect(transport).toBeDefined();

    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    expect(StdioClientTransport).toHaveBeenCalledWith({
      command: 'npx',
      args: ['server'],
      env: expect.objectContaining({ KEY: 'val' }),
    });
  });

  it('creates SSEClientTransport for SSE config', async () => {
    const config: MCPSSEConfig = {
      transport: 'sse',
      url: 'https://mcp.example.com/sse',
      headers: { Authorization: 'Bearer token' },
      enabled: true,
    };
    const transport = await createTransport(config);
    expect(transport).toBeDefined();

    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
    expect(SSEClientTransport).toHaveBeenCalledWith(
      new URL('https://mcp.example.com/sse'),
      { requestInit: { headers: { Authorization: 'Bearer token' } } },
    );
  });

  it('creates StreamableHTTPClientTransport for HTTP config', async () => {
    const config: MCPHTTPConfig = {
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { 'X-API-Key': 'key123' },
      enabled: true,
    };
    const transport = await createTransport(config);
    expect(transport).toBeDefined();

    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
      new URL('https://mcp.example.com/mcp'),
      { requestInit: { headers: { 'X-API-Key': 'key123' } } },
    );
  });

  it('merges process.env with stdio env', async () => {
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    vi.mocked(StdioClientTransport).mockClear();

    const config: MCPStdioConfig = { command: 'echo', args: [], env: { CUSTOM: 'val' }, enabled: true };
    await createTransport(config);

    const callArgs = vi.mocked(StdioClientTransport).mock.calls[0]?.[0] as { env: Record<string, string> };
    expect(callArgs.env.CUSTOM).toBe('val');
  });
});
