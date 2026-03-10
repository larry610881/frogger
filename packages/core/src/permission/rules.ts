import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { CONFIG_DIR } from '@frogger/shared';

const permissionRulesSchema = z.object({
  allowedTools: z.array(z.string()).default([]),
  deniedTools: z.array(z.string()).default([]),
});

export interface PermissionRulesFile {
  allowedTools: string[];
  deniedTools: string[];
}

function emptyRules(): PermissionRulesFile {
  return { allowedTools: [], deniedTools: [] };
}

export function getProjectPermissionsPath(workDir: string): string {
  return path.join(workDir, '.frogger', 'permissions.json');
}

export function getGlobalPermissionsPath(): string {
  return path.join(homedir(), CONFIG_DIR, 'permissions.json');
}

export function loadPermissionRules(filePath: string): PermissionRulesFile {
  if (!existsSync(filePath)) return emptyRules();
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const result = permissionRulesSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : emptyRules();
  } catch {
    return emptyRules();
  }
}

export function savePermissionRule(
  filePath: string,
  kind: 'allow' | 'deny',
  rule: string,
): void {
  const rules = loadPermissionRules(filePath);
  const list = kind === 'allow' ? rules.allowedTools : rules.deniedTools;
  if (!list.includes(rule)) {
    list.push(rule);
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(rules, null, 2) + '\n', 'utf-8');
}

/**
 * Build a permission rule string from a tool name and its args.
 * - bash tool: "bash:{command}" (e.g. "bash:npm test")
 * - other tools: just the tool name (e.g. "write-file")
 */
export function buildPermissionRule(
  toolName: string,
  args: Record<string, unknown>,
): string {
  if (toolName === 'bash' && typeof args.command === 'string') {
    return `bash:${args.command}`;
  }
  return toolName;
}

/**
 * Check if a persisted rule matches a tool call.
 *
 * Matching logic:
 * - "write-file" → exact tool name match
 * - "bash" → matches ALL bash calls
 * - "bash:npm test" → command equals "npm test" or starts with "npm test " (prefix match)
 * - "bash:git *" → trailing " *" means prefix match: command starts with "git "
 */
export function matchesRule(
  rule: string,
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  // Non-bash rules: exact tool name match
  if (!rule.startsWith('bash')) {
    return rule === toolName;
  }

  // Rule is bash-related but tool is not bash
  if (toolName !== 'bash') return false;

  // "bash" without colon → match all bash calls
  if (rule === 'bash') return true;

  // "bash:..." → extract the command pattern
  const ruleCommand = rule.slice(5); // after "bash:"
  const command = typeof args.command === 'string' ? args.command : '';

  // Glob-style trailing " *" → prefix match
  if (ruleCommand.endsWith(' *')) {
    const prefix = ruleCommand.slice(0, -1); // "git *" → "git "
    return command.startsWith(prefix);
  }

  // Exact match or prefix match (command starts with rule + space)
  return command === ruleCommand || command.startsWith(ruleCommand + ' ');
}

/**
 * Resolve permission for a tool call by checking persisted rules.
 * Priority: project deny > project allow > global deny > global allow > null
 */
export function resolvePermission(
  toolName: string,
  args: Record<string, unknown>,
  workDir: string,
): 'allow' | 'deny' | null {
  const projectPath = getProjectPermissionsPath(workDir);
  const globalPath = getGlobalPermissionsPath();

  const projectRules = loadPermissionRules(projectPath);
  const globalRules = loadPermissionRules(globalPath);

  // Project deny takes highest priority
  if (projectRules.deniedTools.some(r => matchesRule(r, toolName, args))) {
    return 'deny';
  }

  // Project allow
  if (projectRules.allowedTools.some(r => matchesRule(r, toolName, args))) {
    return 'allow';
  }

  // Global deny
  if (globalRules.deniedTools.some(r => matchesRule(r, toolName, args))) {
    return 'deny';
  }

  // Global allow
  if (globalRules.allowedTools.some(r => matchesRule(r, toolName, args))) {
    return 'allow';
  }

  return null;
}
