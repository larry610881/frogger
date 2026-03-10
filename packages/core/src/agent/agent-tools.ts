import type { Tool } from 'ai';
import type { ApprovalPolicy } from '@frogger/shared';
import { createToolRegistry, type PermissionRequestCallback } from '../tools/index.js';
import { CheckpointManager } from './checkpoint.js';
import { getProjectPermissionsPath, loadPermissionRules, type PermissionRulesFile } from '../permission/rules.js';
import { isPermissionsConfirmed, confirmPermissions } from '../permission/confirmed-permissions.js';

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

  if (enableCheckpoints) {
    if (!checkpointManager) {
      const isGitRepo = await CheckpointManager.detectGitRepo(workingDirectory);
      checkpointManager = new CheckpointManager({ workingDirectory, isGitRepo });
    }

    onBeforeExecute = async (toolName: string, args: Record<string, unknown>) => {
      const messageIndex = getMessageCount?.() ?? 0;
      await checkpointManager!.createCheckpoint(toolName, args, messageIndex);
    };
  }

  const tools = registry.getToolsWithPermission(
    allowedTools,
    policy,
    permissionCallback,
    workingDirectory,
    onBeforeExecute,
  );

  return { tools, checkpointManager };
}
