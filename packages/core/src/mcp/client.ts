import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { MCPServerConfig } from './config.js';
import { createTransport, getTransportType } from './transport-factory.js';
import { logger } from '../utils/logger.js';

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPClientManagerOptions {
  maxRetries?: number;
  delayFn?: (ms: number) => Promise<void>;
}

export interface ReconnectResult {
  name: string;
  success: boolean;
  error?: string;
}

const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MCPClientManager {
  private clients = new Map<string, Client>();
  private transports = new Map<string, Transport>();
  private configs = new Map<string, MCPServerConfig>();
  private maxRetries: number;
  private delayFn: (ms: number) => Promise<void>;

  constructor(options?: MCPClientManagerOptions) {
    this.maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.delayFn = options?.delayFn ?? defaultDelay;
  }

  /**
   * Register a server config without connecting.
   */
  registerConfig(name: string, config: MCPServerConfig): void {
    this.configs.set(name, config);
  }

  /**
   * Connect to an MCP server using the appropriate transport with exponential backoff retry.
   */
  async connect(name: string, config: MCPServerConfig): Promise<void> {
    if (this.clients.has(name)) {
      logger.debug(`MCP server "${name}" already connected`);
      return;
    }

    // Store config for potential reconnect
    this.configs.set(name, config);

    const transportType = getTransportType(config);
    logger.debug(`Connecting to MCP server "${name}" via ${transportType} transport`);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const transport = await createTransport(config);

        const client = new Client(
          { name: `frogger-${name}`, version: '0.1.0' },
          { capabilities: {} },
        );

        await client.connect(transport);
        this.clients.set(name, client);
        this.transports.set(name, transport);
        logger.debug(`MCP server "${name}" connected via ${transportType}`);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < this.maxRetries) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
          logger.warn(`MCP server "${name}" connection attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
          await this.delayFn(delayMs);
        }
      }
    }

    throw lastError!;
  }

  /**
   * List available tools from a connected MCP server.
   */
  async listTools(name: string): Promise<MCPToolInfo[]> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`MCP server "${name}" is not connected`);
    }

    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Call a tool on a connected MCP server.
   */
  async callTool(
    name: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`MCP server "${name}" is not connected`);
    }

    const result = await client.callTool({ name: toolName, arguments: args });
    // Extract text content from MCP response
    if (result.content && Array.isArray(result.content)) {
      const textParts = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text);
      return textParts.join('\n');
    }
    return result.content;
  }

  /**
   * Close all connected MCP server connections.
   */
  async closeAll(): Promise<void> {
    const names = [...this.clients.keys()];
    for (const name of names) {
      try {
        const client = this.clients.get(name);
        await client?.close();
        logger.debug(`MCP server "${name}" disconnected`);
      } catch (err) {
        logger.warn(`Failed to close MCP server "${name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.clients.clear();
    this.transports.clear();
  }

  /**
   * Get list of connected server names.
   */
  getConnectedServers(): string[] {
    return [...this.clients.keys()];
  }

  /**
   * Check if a server is connected.
   */
  isConnected(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * Get list of registered but not currently connected servers.
   */
  getDisconnectedServers(): string[] {
    return [...this.configs.keys()].filter((name) => !this.clients.has(name));
  }

  /**
   * Reconnect all disconnected servers that have stored configs.
   */
  async reconnectAll(): Promise<ReconnectResult[]> {
    const disconnected = this.getDisconnectedServers();
    const results: ReconnectResult[] = [];

    for (const name of disconnected) {
      const config = this.configs.get(name)!;
      try {
        await this.connect(name, config);
        results.push({ name, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ name, success: false, error: message });
      }
    }

    return results;
  }
}
