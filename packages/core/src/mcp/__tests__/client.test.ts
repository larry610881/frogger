import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockConnect: ReturnType<typeof vi.fn>;
let mockClose: ReturnType<typeof vi.fn>;

// Mock the MCP SDK client
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  const MockClient = vi.fn(function (this: Record<string, unknown>) {
    this.connect = mockConnect;
    this.close = mockClose;
  });
  return { Client: MockClient };
});

// Mock the transport factory to avoid real transport creation
vi.mock('../transport-factory.js', () => ({
  createTransport: vi.fn().mockResolvedValue({ type: 'mock-transport' }),
  getTransportType: vi.fn().mockReturnValue('stdio'),
}));

import { MCPClientManager } from '../client.js';
import type { MCPStdioConfig } from '../config.js';

describe('MCPClientManager', () => {
  const mockConfig: MCPStdioConfig = {
    command: 'npx',
    args: ['-y', 'mock-server'],
    env: {},
    enabled: true,
  };

  beforeEach(() => {
    mockConnect = vi.fn().mockResolvedValue(undefined);
    mockClose = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect with retry', () => {
    it('connects successfully on first attempt', async () => {
      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await manager.connect('test-server', mockConfig);

      expect(manager.isConnected('test-server')).toBe(true);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds on 3rd attempt', async () => {
      const error = new Error('Connection refused');
      mockConnect
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined);

      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await manager.connect('test-server', mockConfig);

      expect(manager.isConnected('test-server')).toBe(true);
      expect(mockConnect).toHaveBeenCalledTimes(3);
    });

    it('gives up after max retries and throws', async () => {
      const error = new Error('Connection refused');
      mockConnect.mockRejectedValue(error);

      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await expect(manager.connect('test-server', mockConfig)).rejects.toThrow('Connection refused');

      expect(manager.isConnected('test-server')).toBe(false);
      // 1 initial + 3 retries = 4 total attempts
      expect(mockConnect).toHaveBeenCalledTimes(4);
    });

    it('uses exponential backoff delays', async () => {
      const error = new Error('Connection refused');
      mockConnect.mockRejectedValue(error);

      const delays: number[] = [];
      const delayFn = (ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      };

      const manager = new MCPClientManager({ delayFn });
      await expect(manager.connect('test-server', mockConfig)).rejects.toThrow();

      // 3 retries: 1000ms, 2000ms, 4000ms
      expect(delays).toEqual([1000, 2000, 4000]);
    });

    it('skips retry for already connected server', async () => {
      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await manager.connect('test-server', mockConfig);

      // Second call should be a no-op
      await manager.connect('test-server', mockConfig);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('times out if server connection hangs', async () => {
      vi.useFakeTimers();
      // Mock connect that never resolves
      mockConnect.mockReturnValue(new Promise(() => {}));

      const manager = new MCPClientManager({ maxRetries: 0, delayFn: () => Promise.resolve() });
      // Capture the rejection eagerly to avoid unhandled rejection
      const promise = manager.connect('hanging-server', mockConfig).catch((e: Error) => e);

      // Advance past the 30s timeout and flush microtasks
      await vi.advanceTimersByTimeAsync(30_000);

      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/connection timed out/);
      vi.useRealTimers();
    });
  });

  describe('connect with SSE config', () => {
    it('connects with SSE transport config', async () => {
      const sseConfig = {
        transport: 'sse' as const,
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer token' },
        enabled: true,
      };

      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await manager.connect('sse-server', sseConfig);
      expect(manager.isConnected('sse-server')).toBe(true);
    });

    it('connects with HTTP transport config', async () => {
      const httpConfig = {
        transport: 'http' as const,
        url: 'https://mcp.example.com/mcp',
        headers: {},
        enabled: true,
      };

      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      await manager.connect('http-server', httpConfig);
      expect(manager.isConnected('http-server')).toBe(true);
    });
  });

  describe('reconnect', () => {
    it('getDisconnectedServers returns servers that were registered but not connected', async () => {
      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      manager.registerConfig('server-a', mockConfig);
      manager.registerConfig('server-b', mockConfig);

      await manager.connect('server-a', mockConfig);
      expect(manager.getDisconnectedServers()).toEqual(['server-b']);

      await manager.closeAll();
      expect(manager.getDisconnectedServers()).toEqual(['server-a', 'server-b']);
    });

    it('reconnectAll reconnects all disconnected servers', async () => {
      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      manager.registerConfig('server-a', mockConfig);
      manager.registerConfig('server-b', mockConfig);

      await manager.connect('server-a', mockConfig);
      await manager.connect('server-b', mockConfig);
      await manager.closeAll();

      const results = await manager.reconnectAll();
      expect(results).toEqual([
        { name: 'server-a', success: true },
        { name: 'server-b', success: true },
      ]);
      expect(manager.isConnected('server-a')).toBe(true);
      expect(manager.isConnected('server-b')).toBe(true);
    });

    it('reconnectAll reports failures', async () => {
      const error = new Error('Connection refused');

      const manager = new MCPClientManager({ delayFn: () => Promise.resolve() });
      manager.registerConfig('server-a', mockConfig);
      manager.registerConfig('server-b', mockConfig);

      await manager.connect('server-a', mockConfig);
      await manager.connect('server-b', mockConfig);
      await manager.closeAll();

      // All reconnect attempts fail
      mockConnect.mockRejectedValue(error);

      const results = await manager.reconnectAll();
      expect(results).toEqual([
        { name: 'server-a', success: false, error: 'Connection refused' },
        { name: 'server-b', success: false, error: 'Connection refused' },
      ]);
    });
  });
});
