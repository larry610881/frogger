import { execFile } from 'node:child_process';
import type { HookEntry } from './config.js';
import { logger } from '../utils/logger.js';
import { MAX_TOOL_RESULT_SIZE } from '@frogger/shared';

export interface HookContext {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolResult?: string;
  hookType: 'PreToolUse' | 'PostToolUse';
  workingDirectory: string;
}

export interface HookResult {
  success: boolean;
  stdout: string;
  stderr: string;
  hookEntry: HookEntry;
}

/**
 * Check if a hook's matcher matches a tool name.
 * - `*` matches everything
 * - `foo-*` prefix match (tool name starts with `foo-`)
 * - `foo` exact match
 */
export function matchesToolName(matcher: string, toolName: string): boolean {
  if (matcher === '*') return true;
  if (matcher.endsWith('*')) {
    return toolName.startsWith(matcher.slice(0, -1));
  }
  return matcher === toolName;
}

/**
 * Truncate a string to maxSize, appending '\n[truncated]' if it exceeds the limit.
 */
export function truncateOutput(value: string, maxSize: number): string {
  if (value.length <= maxSize) return value;
  return value.slice(0, maxSize) + '\n[truncated]';
}

/**
 * Execute a single hook command with the given environment variables.
 */
function executeHook(entry: HookEntry, context: HookContext): Promise<HookResult> {
  return new Promise((resolve) => {
    const env: Record<string, string> = {
      ...process.env,
      FROGGER_TOOL_NAME: context.toolName,
      FROGGER_TOOL_ARGS: JSON.stringify(context.toolArgs),
      FROGGER_HOOK_TYPE: context.hookType,
      FROGGER_WORKING_DIR: context.workingDirectory,
    };

    if (context.toolResult !== undefined) {
      env.FROGGER_TOOL_RESULT = truncateOutput(context.toolResult, MAX_TOOL_RESULT_SIZE);
    }

    const timeout = entry.timeout ?? 10_000;

    execFile('sh', ['-c', entry.command], { env, timeout, cwd: context.workingDirectory }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          stdout: stdout ?? '',
          stderr: stderr || (err instanceof Error ? err.message : String(err)),
          hookEntry: entry,
        });
      } else {
        resolve({ success: true, stdout, stderr, hookEntry: entry });
      }
    });
  });
}

/**
 * Run all matching hooks for a given context.
 *
 * For PreToolUse: stops at first failure (fail-fast).
 * For PostToolUse: runs all hooks, logs warnings on failure.
 */
export async function runHooks(
  hooks: HookEntry[],
  context: HookContext,
): Promise<HookResult[]> {
  const matching = hooks.filter(h => matchesToolName(h.matcher, context.toolName));
  if (matching.length === 0) return [];

  const results: HookResult[] = [];

  for (const hook of matching) {
    const result = await executeHook(hook, context);
    results.push(result);

    if (!result.success) {
      if (context.hookType === 'PreToolUse') {
        // Fail-fast: stop executing remaining hooks
        logger.warn(`PreToolUse hook failed: ${hook.command} — ${result.stderr}`);
        break;
      } else {
        // PostToolUse: warn but continue
        logger.warn(`PostToolUse hook failed: ${hook.command} — ${result.stderr}`);
      }
    }
  }

  return results;
}
