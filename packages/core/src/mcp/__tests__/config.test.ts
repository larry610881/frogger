import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadMCPConfig } from '../config.js';
import type { MCPStdioConfig, MCPSSEConfig, MCPHTTPConfig } from '../config.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('loadMCPConfig', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('{}');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty servers when no config files exist', () => {
    const config = loadMCPConfig('/project');
    expect(config.servers).toEqual({});
  });

  it('loads stdio config (implicit transport)', () => {
    const mcpJson = JSON.stringify({
      servers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          enabled: true,
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    const server = config.servers.filesystem as MCPStdioConfig;
    expect(server).toBeDefined();
    expect(server.command).toBe('npx');
    expect(server.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
  });

  it('loads stdio config with explicit transport', () => {
    const mcpJson = JSON.stringify({
      servers: {
        test: {
          transport: 'stdio',
          command: 'echo',
          args: ['hello'],
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    const server = config.servers.test as MCPStdioConfig;
    expect(server.transport).toBe('stdio');
    expect(server.command).toBe('echo');
  });

  it('loads SSE config', () => {
    const mcpJson = JSON.stringify({
      servers: {
        remote: {
          transport: 'sse',
          url: 'https://mcp.example.com/sse',
          headers: { 'Authorization': 'Bearer token123' },
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    const server = config.servers.remote as MCPSSEConfig;
    expect(server.transport).toBe('sse');
    expect(server.url).toBe('https://mcp.example.com/sse');
    expect(server.headers.Authorization).toBe('Bearer token123');
  });

  it('loads HTTP (Streamable HTTP) config', () => {
    const mcpJson = JSON.stringify({
      servers: {
        api: {
          transport: 'http',
          url: 'https://mcp.example.com/mcp',
          headers: { 'X-API-Key': 'key123' },
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    const server = config.servers.api as MCPHTTPConfig;
    expect(server.transport).toBe('http');
    expect(server.url).toBe('https://mcp.example.com/mcp');
    expect(server.headers['X-API-Key']).toBe('key123');
  });

  it('merges project and global config with project priority', () => {
    const globalJson = JSON.stringify({
      servers: {
        github: { command: 'npx', args: ['server-github'] },
        shared: { command: 'global-cmd', args: [] },
      },
    });
    const projectJson = JSON.stringify({
      servers: {
        filesystem: { command: 'npx', args: ['server-fs'] },
        shared: { command: 'project-cmd', args: ['override'] },
      },
    });

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation((p) => {
      if (String(p).includes('/project')) return projectJson;
      return globalJson;
    });

    const config = loadMCPConfig('/project');
    expect(Object.keys(config.servers)).toHaveLength(3);
    expect((config.servers.github as MCPStdioConfig).command).toBe('npx');
    expect((config.servers.filesystem as MCPStdioConfig).command).toBe('npx');
    // Project overrides global
    expect((config.servers.shared as MCPStdioConfig).command).toBe('project-cmd');
  });

  it('resolves ${ENV_VAR} in stdio env values', () => {
    const originalEnv = process.env.MY_TOKEN;
    process.env.MY_TOKEN = 'secret123';

    const mcpJson = JSON.stringify({
      servers: {
        github: {
          command: 'npx',
          args: ['server-github'],
          env: { GITHUB_TOKEN: '${MY_TOKEN}' },
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    expect((config.servers.github as MCPStdioConfig).env.GITHUB_TOKEN).toBe('secret123');

    if (originalEnv !== undefined) {
      process.env.MY_TOKEN = originalEnv;
    } else {
      delete process.env.MY_TOKEN;
    }
  });

  it('resolves ${ENV_VAR} in SSE/HTTP headers', () => {
    const originalEnv = process.env.API_TOKEN;
    process.env.API_TOKEN = 'bearer-xyz';

    const mcpJson = JSON.stringify({
      servers: {
        remote: {
          transport: 'sse',
          url: 'https://mcp.example.com/sse',
          headers: { 'Authorization': 'Bearer ${API_TOKEN}' },
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    expect((config.servers.remote as MCPSSEConfig).headers.Authorization).toBe('Bearer bearer-xyz');

    if (originalEnv !== undefined) {
      process.env.API_TOKEN = originalEnv;
    } else {
      delete process.env.API_TOKEN;
    }
  });

  it('handles invalid JSON gracefully', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue('not valid json');

    const config = loadMCPConfig('/project');
    expect(config.servers).toEqual({});
  });

  it('handles invalid schema gracefully', () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ servers: 'not an object' }));

    const config = loadMCPConfig('/project');
    expect(config.servers).toEqual({});
  });

  it('defaults enabled to true when not specified', () => {
    const mcpJson = JSON.stringify({
      servers: {
        test: { command: 'echo', args: ['hello'] },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    expect(config.servers.test.enabled).toBe(true);
  });

  it('respects enabled: false', () => {
    const mcpJson = JSON.stringify({
      servers: {
        disabled: { command: 'echo', args: [], enabled: false },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    expect(config.servers.disabled.enabled).toBe(false);
  });

  it('rejects SSE config with invalid URL', () => {
    const mcpJson = JSON.stringify({
      servers: {
        bad: {
          transport: 'sse',
          url: 'not-a-url',
        },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    // Should fail validation and return empty
    expect(config.servers).toEqual({});
  });

  it('supports mixed transport types in one config', () => {
    const mcpJson = JSON.stringify({
      servers: {
        local: { command: 'npx', args: ['server-local'] },
        remote: { transport: 'sse', url: 'https://mcp.example.com/sse' },
        api: { transport: 'http', url: 'https://mcp.example.com/mcp' },
      },
    });

    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).includes('.frogger/mcp.json') && String(p).includes('/project'),
    );
    vi.mocked(readFileSync).mockReturnValue(mcpJson);

    const config = loadMCPConfig('/project');
    expect(Object.keys(config.servers)).toHaveLength(3);
    expect((config.servers.local as MCPStdioConfig).command).toBe('npx');
    expect((config.servers.remote as MCPSSEConfig).transport).toBe('sse');
    expect((config.servers.api as MCPHTTPConfig).transport).toBe('http');
  });
});
