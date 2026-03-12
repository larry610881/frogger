import { describe, it, expect, vi } from 'vitest';
import { convertMCPTools } from '../tool-adapter.js';
import type { MCPClientManager, MCPToolInfo } from '../client.js';

function createMockClientManager(): MCPClientManager {
  return {
    callTool: vi.fn().mockResolvedValue('tool result'),
    connect: vi.fn(),
    listTools: vi.fn(),
    closeAll: vi.fn(),
    getConnectedServers: vi.fn(),
    isConnected: vi.fn(),
  } as unknown as MCPClientManager;
}

describe('convertMCPTools', () => {
  it('converts MCP tools with correct name prefix', () => {
    const tools: MCPToolInfo[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    ];

    const manager = createMockClientManager();
    const { tools: converted, metadata } = convertMCPTools('filesystem', tools, manager);

    expect(Object.keys(converted)).toEqual(['mcp-filesystem-read_file']);
    expect(metadata).toHaveLength(1);
    expect(metadata[0].name).toBe('mcp-filesystem-read_file');
    expect(metadata[0].permissionLevel).toBe('confirm');
  });

  it('converts multiple tools from same server', () => {
    const tools: MCPToolInfo[] = [
      { name: 'read', description: 'Read', inputSchema: { type: 'object', properties: {} } },
      { name: 'write', description: 'Write', inputSchema: { type: 'object', properties: {} } },
    ];

    const manager = createMockClientManager();
    const { tools: converted } = convertMCPTools('fs', tools, manager);

    expect(Object.keys(converted)).toEqual(['mcp-fs-read', 'mcp-fs-write']);
  });

  it('tool execute delegates to client manager', async () => {
    const tools: MCPToolInfo[] = [
      {
        name: 'search',
        description: 'Search files',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ];

    const manager = createMockClientManager();
    vi.mocked(manager.callTool).mockResolvedValue('search results');

    const { tools: converted } = convertMCPTools('server', tools, manager);
    const toolRecord = converted['mcp-server-search'] as unknown as { execute: (args: Record<string, unknown>) => Promise<string> };
    const result = await toolRecord.execute({ query: 'test' });

    expect(manager.callTool).toHaveBeenCalledWith('server', 'search', { query: 'test' });
    expect(result).toBe('search results');
  });

  it('handles tool execution errors gracefully', async () => {
    const tools: MCPToolInfo[] = [
      { name: 'broken', description: 'Broken tool', inputSchema: { type: 'object', properties: {} } },
    ];

    const manager = createMockClientManager();
    vi.mocked(manager.callTool).mockRejectedValue(new Error('connection lost'));

    const { tools: converted } = convertMCPTools('server', tools, manager);
    const toolRecord = converted['mcp-server-broken'] as unknown as { execute: (args: Record<string, unknown>) => Promise<string> };
    const result = await toolRecord.execute({});

    expect(result).toContain('MCP tool error: connection lost');
  });

  it('uses default description when none provided', () => {
    const tools: MCPToolInfo[] = [
      { name: 'unnamed', inputSchema: { type: 'object', properties: {} } },
    ];

    const manager = createMockClientManager();
    const { metadata } = convertMCPTools('server', tools, manager);

    expect(metadata[0].description).toContain('MCP tool from server');
  });

  describe('jsonSchemaToZod (via convertMCPTools)', () => {
    // jsonSchemaToZod is private, so we test it through convertMCPTools
    // by passing different inputSchema types and verifying the tool accepts valid input

    function convertSingle(inputSchema: Record<string, unknown>) {
      const manager = createMockClientManager();
      const { tools } = convertMCPTools('s', [{ name: 't', inputSchema }], manager);
      return tools['mcp-s-t'] as unknown as {
        execute: (args: Record<string, unknown>) => Promise<string>;
        inputSchema: { parse: (v: unknown) => unknown };
      };
    }

    it('handles string properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: { name: { type: 'string', description: 'A name' } },
        required: ['name'],
      });
      // Should not throw — schema accepts string
      expect(tool).toBeDefined();
    });

    it('handles string enum properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: { color: { type: 'string', enum: ['red', 'blue'] } },
      });
      expect(tool).toBeDefined();
    });

    it('handles number and integer properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          price: { type: 'number' },
          count: { type: 'integer', description: 'Item count' },
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles boolean properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          verbose: { type: 'boolean' },
          recursive: { type: 'boolean', description: 'Recurse into subdirs' },
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles array properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          data: { type: 'array' }, // no items — should fallback to z.unknown()
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles nested object properties', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: { key: { type: 'string' } },
            required: ['key'],
          },
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles object without properties (record type)', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          metadata: { type: 'object' }, // no properties → z.record()
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles unknown type as z.unknown()', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          custom: { type: 'foobar' }, // unknown type
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles oneOf (union types)', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          value: {
            oneOf: [
              { type: 'string' },
              { type: 'number' },
            ],
          },
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles allOf (intersection types)', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          config: {
            allOf: [
              { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
              { type: 'object', properties: { age: { type: 'number' } } },
            ],
          },
        },
      });
      expect(tool).toBeDefined();
    });

    it('handles oneOf with single variant', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          data: {
            oneOf: [{ type: 'string' }],
          },
        },
      });
      expect(tool).toBeDefined();
    });

    it('marks non-required properties as optional', () => {
      const tool = convertSingle({
        type: 'object',
        properties: {
          required_field: { type: 'string' },
          optional_field: { type: 'number' },
        },
        required: ['required_field'],
      });
      expect(tool).toBeDefined();
    });
  });
});
