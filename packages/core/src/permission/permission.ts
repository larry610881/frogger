import type { ApprovalPolicy, PermissionLevel, PermissionResponse } from '@frogger/shared';

export type PermissionCallback = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<PermissionResponse>;

export class PermissionManager {
  private alwaysAllowed = new Set<string>();

  async check(
    toolName: string,
    args: Record<string, unknown>,
    policy: ApprovalPolicy,
    permissionLevel: PermissionLevel,
    callback: PermissionCallback,
  ): Promise<boolean> {
    // auto policy always allows
    if (policy === 'auto') {
      return true;
    }

    // If already marked as always-allowed
    if (this.alwaysAllowed.has(toolName)) {
      return true;
    }

    // confirm-writes: only ask for tools with 'confirm' permission level
    if (policy === 'confirm-writes' && permissionLevel === 'auto') {
      return true;
    }

    // confirm-all OR (confirm-writes + confirm permission) → ask callback
    const response = await callback(toolName, args);

    if (response === 'always-project' || response === 'always-global') {
      this.alwaysAllowed.add(toolName);
      return true;
    }

    return response === 'allow';
  }

  reset(): void {
    this.alwaysAllowed.clear();
  }
}
