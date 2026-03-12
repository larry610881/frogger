import type { Tool } from 'ai';
import type { ApprovalPolicy } from '@frogger/shared';
import { createToolRegistry, type PermissionRequestCallback } from '../tools/index.js';
import { CheckpointManager } from './checkpoint.js';
import { getProjectPermissionsPath, loadPermissionRules, type PermissionRulesFile } from '../permission/rules.js';
import { isPermissionsConfirmed, confirmPermissions } from '../permission/confirmed-permissions.js';
import { logger } from '../utils/logger.js';

export interface CreateAgentToolsOptions {
  workingDirectory: string;
  allowedTools: readonly string[];
  policy: ApprovalPolicy;
  permissionCallback: PermissionRequestCallback;
  /** Set false to disable checkpoint creation. Default: true */
  enableCheckpoints?: boolean;
  /** Re-use an existing CheckpointManager (e.g. shared with /rewind command).
   *  When provided, `enableCheckpoints` defaults to true. */
  existingCheckpointManager?: CheckpointManager;
  /** Current message count — used as messageIndex for checkpoints */
  getMessageCount?: () => number;
  /** Called when project-level permissions.json is detected but not yet confirmed.
   *  Return true to accept the rules, false to skip them. */
  onProjectPermissionsDetected?: (path: string, rules: PermissionRulesFile) => Promise<boolean>;
}

export interface AgentToolsResult {
  tools: Record<string, Tool>;
  checkpointManager: CheckpointManager | null;
  /** MCP client manager — call closeAll() on exit */
  mcpClientManager: { closeAll(): Promise<void> } | null;
}

/**
 * Factory that assembles tools with permission wrapping and checkpoint hooks.
 * Encapsulates the registry + permission + checkpoint wiring so consumers
 * (CLI, VSCode, pipe mode) don't need to know the details.
 */
export async function createAgentTools(
  options: CreateAgentToolsOptions,
): Promise<AgentToolsResult> {
  const {
    workingDirectory,
    allowedTools,
    policy,
    permissionCallback,
    existingCheckpointManager,
    enableCheckpoints = true,
    getMessageCount,
    onProjectPermissionsDetected,
  } = options;

  // Check project-level permissions.json confirmation
  if (onProjectPermissionsDetected) {
    const projectPermPath = getProjectPermissionsPath(workingDirectory);
    if (!isPermissionsConfirmed(projectPermPath)) {
      const rules = loadPermissionRules(projectPermPath);
      if (rules.allowedTools.length > 0 || rules.deniedTools.length > 0) {
        const accepted = await onProjectPermissionsDetected(projectPermPath, rules);
        if (accepted) {
          confirmPermissions(projectPermPath);
        }
        // If rejected, project rules will still be loaded by resolvePermission
        // but user was warned — this is a best-effort safety measure
      }
    }
  }

  const registry = createToolRegistry(workingDirectory);

  let checkpointManager: CheckpointManager | null = existingCheckpointManager ?? null;
  let onBeforeExecute: ((toolName: string, args: Record<string, unknown>) => Promise<void>) | undefined;
  let onAfterExecute: ((toolName: string, args: Record<string, unknown>, result: string) => Promise<void>) | undefined;

  if (enableCheckpoints) {
    if (!checkpointManager) {
      const isGitRepo = await CheckpointManager.detectGitRepo(workingDirectory);
      checkpointManager = new CheckpointManager({ workingDirectory, isGitRepo });
    }
  }

  // Load hooks config (dynamic import to avoid breaking tests)
  try {
    const { loadHooksConfig, runHooks } = await import('../hooks/index.js');
    const hooksConfig = loadHooksConfig(workingDirectory);

    const hasPreHooks = hooksConfig.hooks.PreToolUse.length > 0;
    const hasPostHooks = hooksConfig.hooks.PostToolUse.length > 0;

    onBeforeExecute = async (toolName: string, args: Record<string, unknown>) => {
      // 1. Checkpoint (if enabled)
      if (enableCheckpoints && checkpointManager) {
        const messageIndex = getMessageCount?.() ?? 0;
        await checkpointManager.createCheckpoint(toolName, args, messageIndex);
      }
      // 2. PreToolUse hooks
      if (hasPreHooks) {
        const results = await runHooks(hooksConfig.hooks.PreToolUse, {
          toolName, toolArgs: args, hookType: 'PreToolUse', workingDirectory,
        });
        const failed = results.find(r => !r.success);
        if (failed) {
          throw new Error(`Blocked by PreToolUse hook: ${failed.stderr || 'non-zero exit'}`);
        }
      }
    };

    if (hasPostHooks) {
      onAfterExecute = async (toolName: string, args: Record<string, unknown>, result: string) => {
        await runHooks(hooksConfig.hooks.PostToolUse, {
          toolName, toolArgs: args, toolResult: result, hookType: 'PostToolUse', workingDirectory,
        });
      };
    }
  } catch {
    // Hooks module not available — fall back to checkpoint-only onBeforeExecute
    if (enableCheckpoints && checkpointManager) {
      onBeforeExecute = async (toolName: string, args: Record<string, unknown>) => {
        const messageIndex = getMessageCount?.() ?? 0;
        await checkpointManager!.createCheckpoint(toolName, args, messageIndex);
      };
    }
  }

  const tools = registry.getToolsWithPermission(
    allowedTools,
    policy,
    permissionCallback,
    workingDirectory,
    onBeforeExecute,
    onAfterExecute,
  );

  // Load and connect MCP servers (dynamic import to avoid breaking tests)
  let mcpClientManager: { closeAll(): Promise<void> } | null = null;
  try {
    const { loadMCPConfig, MCPClientManager, convertMCPTools } = await import('../mcp/index.js');
    const mcpConfig = loadMCPConfig(workingDirectory);
    const enabledServers = Object.entries(mcpConfig.servers).filter(([, cfg]) => cfg.enabled);

    if (enabledServers.length > 0) {
      const manager = new MCPClientManager();
      mcpClientManager = manager;

      for (const [name, serverConfig] of enabledServers) {
        try {
          await manager.connect(name, serverConfig);
          const mcpTools = await manager.listTools(name);
          const { tools: converted, metadata } = convertMCPTools(name, mcpTools, manager);

          // Register MCP tools with confirm permission and merge into tools
          for (const meta of metadata) {
            registry.register(meta.name, converted[meta.name], meta);
          }

          // Add MCP tools with permission wrapping (always confirm policy for external tools)
          const mcpToolNames = metadata.map(m => m.name);
          const mcpWrapped = registry.getToolsWithPermission(
            mcpToolNames,
            'confirm-writes',
            permissionCallback,
            workingDirectory,
            onBeforeExecute,
            onAfterExecute,
          );
          Object.assign(tools, mcpWrapped);

          logger.debug(`MCP server "${name}": ${mcpTools.length} tool(s) loaded`);
        } catch (err) {
          logger.warn(`Failed to connect MCP server "${name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  } catch (err) {
    logger.warn(`MCP initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { tools, checkpointManager, mcpClientManager };
}
