import type { Tool } from 'ai';
import type { ToolMetadata, ApprovalPolicy, PermissionResponse } from '@frogger/shared';
import { resolvePermission, buildPermissionRule, savePermissionRule, getProjectPermissionsPath, getGlobalPermissionsPath } from '../permission/rules.js';
import { logger } from '../utils/logger.js';
import { ReadWriteLock } from './concurrency.js';

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
  private readonly lock = new ReadWriteLock();

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
  /**
   * Wrap a function with the appropriate concurrency lock based on permission level.
   * Read tools (auto) use shared lock; write tools (confirm) use exclusive lock.
   */
  private withLock(
    permissionLevel: 'auto' | 'confirm',
    fn: (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>,
  ): (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string> {
    const acquire = permissionLevel === 'confirm'
      ? () => this.lock.acquireWrite()
      : () => this.lock.acquireRead();

    return async (args, opts) => {
      const release = await acquire();
      try {
        return await fn(args, opts);
      } finally {
        release();
      }
    };
  }

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
      const result: Record<string, Tool> = {};
      for (const [name, t] of this.tools) {
        if (!allowedNames.includes(name)) continue;
        const meta = this.metadata.get(name);
        const toolRecord = t as Record<string, unknown>;
        const origExecute = toolRecord.execute as (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>;
        const inner = hasHooks
          ? (args: Record<string, unknown>, opts: Record<string, unknown>) => callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute)
          : (args: Record<string, unknown>, opts: Record<string, unknown>) => origExecute.call(t, args, opts) as Promise<string>;
        result[name] = {
          ...toolRecord,
          execute: this.withLock(meta?.permissionLevel ?? 'auto', inner),
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

      const toolRecord = t as Record<string, unknown>;
      const origExecute = toolRecord.execute as (args: Record<string, unknown>, opts: Record<string, unknown>) => Promise<string>;

      if (!needsPermission) {
        const inner = hasHooks
          ? (args: Record<string, unknown>, opts: Record<string, unknown>) => callWithHooks(origExecute, t, name, args, opts, onBeforeExecute, onAfterExecute)
          : (args: Record<string, unknown>, opts: Record<string, unknown>) => origExecute.call(t, args, opts) as Promise<string>;
        result[name] = {
          ...toolRecord,
          execute: this.withLock(meta?.permissionLevel ?? 'auto', inner),
        } as unknown as Tool;
        continue;
      }

      // Wrap tool execute with permission check + concurrency lock
      const permissionWrapped = async (args: Record<string, unknown>, opts: Record<string, unknown>) => {
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

        if (response === 'deny-project') {
          if (workingDirectory) {
            const rule = buildPermissionRule(name, args);
            savePermissionRule(getProjectPermissionsPath(workingDirectory), 'deny', rule);
          }
          return 'Tool execution denied by user (saved to project rules).';
        }

        if (response === 'deny-global') {
          const rule = buildPermissionRule(name, args);
          savePermissionRule(getGlobalPermissionsPath(), 'deny', rule);
          return 'Tool execution denied by user (saved to global rules).';
        }

        return 'Tool execution denied by user.';
      };

      result[name] = {
        ...toolRecord,
        execute: this.withLock('confirm', permissionWrapped),
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

  /** Generate categorized tool usage hints for the system prompt */
  getToolHints(): string {
    const categorized = new Map<string, Array<{ name: string; hints: string }>>();

    for (const [, meta] of this.metadata) {
      if (!meta.hints || !meta.category) continue;
      const cat = meta.category;
      if (!categorized.has(cat)) categorized.set(cat, []);
      categorized.get(cat)!.push({ name: meta.name, hints: meta.hints });
    }

    const categoryOrder = ['read', 'write', 'search', 'git', 'test', 'github', 'system', 'mode'];
    const categoryLabels: Record<string, string> = {
      read: 'Reading', write: 'Writing', search: 'Search',
      git: 'Git', test: 'Testing', github: 'GitHub', system: 'System', mode: 'Mode Switching',
    };

    const sections: string[] = [];
    for (const cat of categoryOrder) {
      const tools = categorized.get(cat);
      if (!tools?.length) continue;
      const items = tools.map(t => `- **${t.name}**: ${t.hints}`).join('\n');
      sections.push(`### ${categoryLabels[cat] || cat}\n${items}`);
    }

    return sections.length ? `## Tool Usage Guide\n\n${sections.join('\n\n')}` : '';
  }
}
