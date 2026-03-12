import type { SlashCommand } from './types.js';
import { loadMCPConfig } from '../mcp/index.js';

export const mcpCommand: SlashCommand = {
  name: 'mcp',
  description: 'List MCP servers and their tools, or reconnect disconnected servers',
  usage: '/mcp [reconnect]',

  async execute(args, context) {
    if (args[0] === 'reconnect') {
      return handleReconnect(context);
    }

    return handleList();
  },
};

function handleList() {
  const workingDirectory = process.cwd();
  const config = loadMCPConfig(workingDirectory);
  const servers = Object.entries(config.servers);

  if (servers.length === 0) {
    return {
      type: 'message' as const,
      message: 'No MCP servers configured.\n\nAdd servers to `.frogger/mcp.json` or `~/.frogger/mcp.json`:\n```json\n{\n  "servers": {\n    "example": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]\n    }\n  }\n}\n```',
    };
  }

  const lines = ['MCP Servers:', ''];
  for (const [name, cfg] of servers) {
    const status = cfg.enabled ? '✓' : '✗';
    const detail = cfg.transport === 'sse' || cfg.transport === 'http'
      ? `${cfg.transport}://${cfg.url}`
      : `${(cfg as { command: string }).command} ${(cfg as { args: string[] }).args.join(' ')}`;
    lines.push(`  ${status} ${name} — ${detail}`);
  }

  const enabledCount = servers.filter(([, c]) => c.enabled).length;
  lines.push('');
  lines.push(`Total: ${enabledCount} enabled / ${servers.length} configured`);

  return { type: 'message' as const, message: lines.join('\n') };
}

async function handleReconnect(context: Parameters<typeof mcpCommand.execute>[1]) {
  const manager = context.mcpClientManager;
  if (!manager) {
    return {
      type: 'error' as const,
      message: 'MCP client manager not available.',
    };
  }

  const disconnected = manager.getDisconnectedServers();
  if (disconnected.length === 0) {
    return {
      type: 'message' as const,
      message: 'All configured MCP servers are already connected.',
    };
  }

  const results = await manager.reconnectAll();
  const lines = ['MCP Reconnect Results:', ''];

  for (const result of results) {
    if (result.success) {
      lines.push(`  ✓ ${result.name} — reconnected`);
    } else {
      lines.push(`  ✗ ${result.name} — failed: ${result.error}`);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  lines.push('');
  lines.push(`Reconnected: ${successCount}/${results.length}`);

  return { type: 'message' as const, message: lines.join('\n') };
}
