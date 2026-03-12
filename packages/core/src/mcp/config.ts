import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { CONFIG_DIR } from '@frogger/shared';
import { logger } from '../utils/logger.js';

// --- Schemas for each transport type ---

const sseServerConfigSchema = z.object({
  transport: z.literal('sse'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

const httpServerConfigSchema = z.object({
  transport: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

const stdioServerConfigSchema = z.object({
  transport: z.literal('stdio').optional(),
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  enabled: z.boolean().optional().default(true),
});

// Union: SSE first, HTTP second, stdio last (most permissive — transport optional)
const mcpServerConfigSchema = z.union([
  sseServerConfigSchema,
  httpServerConfigSchema,
  stdioServerConfigSchema,
]);

const mcpConfigSchema = z.object({
  servers: z.record(z.string(), mcpServerConfigSchema),
});

// --- Types ---

export interface MCPStdioConfig {
  transport?: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface MCPSSEConfig {
  transport: 'sse';
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
}

export interface MCPHTTPConfig {
  transport: 'http';
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
}

export type MCPServerConfig = MCPStdioConfig | MCPSSEConfig | MCPHTTPConfig;

export interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
}

// --- Helpers ---

/**
 * Resolve environment variable references like ${VAR_NAME} in string record values.
 */
export function resolveEnvVars(env: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    resolved[key] = value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
      return process.env[varName] ?? '';
    });
  }
  return resolved;
}

/**
 * Resolve env vars on the appropriate fields based on transport type.
 */
function resolveServerEnvVars(config: MCPServerConfig): MCPServerConfig {
  if (config.transport === 'sse' || config.transport === 'http') {
    return { ...config, headers: resolveEnvVars(config.headers) };
  }
  // stdio (transport is undefined or 'stdio')
  return { ...config, env: resolveEnvVars((config as MCPStdioConfig).env) } as MCPServerConfig;
}

/**
 * Load MCP config from a JSON file. Returns null if file doesn't exist or is invalid.
 */
function loadMCPConfigFile(filePath: string): MCPConfig | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = mcpConfigSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn(`Invalid MCP config at ${filePath}: ${result.error.message}`);
      return null;
    }
    return result.data as MCPConfig;
  } catch (err) {
    logger.warn(`Failed to read MCP config at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Load MCP configuration by merging project-level and global-level configs.
 * Project-level config takes priority over global config.
 */
export function loadMCPConfig(workingDirectory: string): MCPConfig {
  const projectPath = join(workingDirectory, CONFIG_DIR, 'mcp.json');
  const globalPath = join(homedir(), CONFIG_DIR, 'mcp.json');

  const projectConfig = loadMCPConfigFile(projectPath);
  const globalConfig = loadMCPConfigFile(globalPath);

  const merged: MCPConfig = { servers: {} };

  // Global servers first (lower priority)
  if (globalConfig) {
    for (const [name, config] of Object.entries(globalConfig.servers)) {
      merged.servers[name] = resolveServerEnvVars(config);
    }
  }

  // Project servers override global
  if (projectConfig) {
    for (const [name, config] of Object.entries(projectConfig.servers)) {
      merged.servers[name] = resolveServerEnvVars(config);
    }
  }

  const enabledCount = Object.values(merged.servers).filter(s => s.enabled).length;
  if (enabledCount > 0) {
    logger.debug(`MCP config loaded — ${enabledCount} enabled server(s)`);
  }

  return merged;
}
