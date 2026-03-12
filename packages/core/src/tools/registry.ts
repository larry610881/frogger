import type { Tool } from 'ai';
import type { ToolMetadata, ApprovalPolicy, PermissionResponse } from '@frogger/shared';
import { resolvePermission, buildPermissionRule, savePermissionRule, getProjectPermissionsPath, getGlobalPermissionsPath } from '../permission/rules.js';
import { logger } from '../utils/logger.js';

export type PermissionRequestCallback = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<PermissionResponse>;

/**
 * Execute a tool with optional pre/post hooks.
 * If onBeforeExecute throws, the error message is returned as the tool result
 * (used by PreToolUse hooks to block execution).
 */
async function callWithHooks(
  origExecute: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>,
  thisArg: Tool,
  name: string,
  args: Record<string, unknown>,
  opts: Record<string, unknown>,
  onBeforeExecute?: (toolName: string, args: Record<string, unknown>) => Promise<void>,
  onAfterExecute?: (toolName: string, args: Record<string, unknown>, result: string) => Promise<void>,
): Promise<string> {
  try {
    if (onBeforeExecute) await onBeforeExecute(name, args);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }

  const result = await origExecute.call(thisArg, args, opts) as string;

  if (onAfterExecute) {
    try {
      await onAfterExecute(name, args, result);
    } catch (err) {
      logger.warn(`onAfterExecute error for ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private metadata = new Map<string, ToolMetadata>();

  register(name: string, tool: Tool, metadata: ToolMetadata): void {
    this.tools.set(name, tool);
    this.metadata.set(name, metadata);
  }

  getTools(allowedNames?: readonly string[]): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, t] of this.tools) {
      if (!allowedNames || allowedNames.includes(name)) {
        result[name] = t;
      }
    }
    return result;
  }

  /**
   * Get tools with permission wrapping applied.
   * Confirm-level tools will have their execute() wrapped to call the
   * permission callback before execution.
   *
   * Resolution order:
   * 1. Persisted rules (project/global permissions.json)
   * 2. Session always-allowed set
   * 3. User callback prompt
   */
  getToolsWithPermission(
    allowedNames: readonly string[],
    policy: ApprovalPolicy,
    callback: PermissionRequestCallback,
    workingDirectory?: string,
    onBeforeExecute?: (toolName: string, args: Record<string, unknown>) => Promise<void>,
    onAfterExecute?: (toolName: string, args: Record<string, unknown>, result: string) => Promise<void>,
  ): Record<string, Tool> {
    const hasHooks = onBeforeExecute || onAfterExecute;

    if (policy === 'auto') {
      if (!hasHooks) {
        return this.getTools(allowedNames);
      }
      // Even in auto mode, wrap with hooks
      const result: Record<string, Tool> = {};
      for (const [name, t] of this.tools) {
        if (!allowedNames.includes(name)) continue;
        const toolRecord = t as Record<string, unknown>;
        const origExecute = toolRecord.execute as (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>;
        result[name] = {
          ...toolRecord,
          execute: async (args: Record<string, unknown>, opts: Record<string, unknown>) => {
            return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
          },
        } as unknown as Tool;
      }
      return result;
    }

    const alwaysAllowed = new Set<string>();
    const result: Record<string, Tool> = {};

    for (const [name, t] of this.tools) {
      if (!allowedNames.includes(name)) continue;

      const meta = this.metadata.get(name);
      const needsPermission =
        policy === 'confirm-all' ||
        (policy === 'confirm-writes' && meta?.permissionLevel === 'confirm');

      if (!needsPermission) {
        if (hasHooks) {
          const toolRecord = t as Record<string, unknown>;
          const origExecute = toolRecord.execute as (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>;
          result[name] = {
            ...toolRecord,
            execute: async (args: Record<string, unknown>, opts: Record<string, unknown>) => {
              return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
            },
          } as unknown as Tool;
        } else {
          result[name] = t;
        }
        continue;
      }

      // Wrap tool execute with permission check
      const toolRecord = t as Record<string, unknown>;
      const origExecute = toolRecord.execute as (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>;
      result[name] = {
        ...toolRecord,
        execute: async (args: Record<string, unknown>, opts: Record<string, unknown>) => {
          // 1. Check persisted rules
          if (workingDirectory) {
            const persisted = resolvePermission(name, args, workingDirectory);
            if (persisted === 'allow') {
              logger.debug(`Permission hit: persisted allow for ${name}`);
              return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
            }
            if (persisted === 'deny') return 'Tool execution denied by persisted rule.';
          }

          // 2. Check session always-allowed set
          if (alwaysAllowed.has(name)) {
            return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
          }

          // 3. Ask user
          const response = await callback(name, args);

          if (response === 'always-project') {
            alwaysAllowed.add(name);
            if (workingDirectory) {
              const rule = buildPermissionRule(name, args);
              savePermissionRule(getProjectPermissionsPath(workingDirectory), 'allow', rule);
            }
            return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
          }

          if (response === 'always-global') {
            alwaysAllowed.add(name);
            const rule = buildPermissionRule(name, args);
            savePermissionRule(getGlobalPermissionsPath(), 'allow', rule);
            return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
          }

          if (response === 'allow') {
            return callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute);
          }

          return 'Tool execution denied by user.';
        },
      } as unknown as Tool;
    }

    return result;
  }

  getMetadata(name: string): ToolMetadata | undefined {
    return this.metadata.get(name);
  }

  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }
}
