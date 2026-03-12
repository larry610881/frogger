import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { MCPServerConfig, MCPStdioConfig, MCPSSEConfig, MCPHTTPConfig } from './config.js';

/**
 * Determine the transport type from a server config.
 */
export function getTransportType(config: MCPServerConfig): 'stdio' | 'sse' | 'http' {
  if (config.transport === 'sse') return 'sse';
  if (config.transport === 'http') return 'http';
  return 'stdio';
}

/**
 * Create an MCP transport based on the server config.
 * Uses dynamic imports for SSE/HTTP to avoid loading unnecessary dependencies for stdio-only users.
 */
export async function createTransport(config: MCPServerConfig): Promise<Transport> {
  const type = getTransportType(config);

  switch (type) {
    case 'stdio': {
      const stdioConfig = config as MCPStdioConfig;
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      return new StdioClientTransport({
        command: stdioConfig.command,
        args: stdioConfig.args,
        env: { ...process.env, ...stdioConfig.env } as Record<string, string>,
      });
    }

    case 'sse': {
      const sseConfig = config as MCPSSEConfig;
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
      return new SSEClientTransport(new URL(sseConfig.url), {
        requestInit: {
          headers: sseConfig.headers,
        },
      });
    }

    case 'http': {
      const httpConfig = config as MCPHTTPConfig;
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
      return new StreamableHTTPClientTransport(new URL(httpConfig.url), {
        requestInit: {
          headers: httpConfig.headers,
        },
      });
    }

    default:
      throw new Error(`Unknown MCP transport type: ${type}`);
  }
}
