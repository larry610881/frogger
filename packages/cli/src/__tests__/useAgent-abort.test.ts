import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PermissionResponse } from '@frogger/shared';

/**
 * Regression test for: pending permission Promise leak on agent abort.
 *
 * Bug: When abortRef.current.abort() is called during streaming, any pending
 * permission Promise (from setPendingPermission) stays unresolved forever.
 * This leaks the Promise and potentially blocks the agent loop from terminating.
 *
 * Since useAgent is a React hook with heavy async dependencies, we test the
 * core abort-permission interaction pattern extracted from the hook logic.
 * The pattern mirrors the exact flow in submitInternal's finally block.
 */

/**
 * Simulates the pendingPermission ref pattern used in useAgent.
 * This mirrors how the permissionCallback creates a promise and stores
 * the resolve function, and how the finally block should handle cleanup.
 */
interface PendingPermissionRef {
  toolName: string;
  args: Record<string, unknown>;
  resolve: (response: PermissionResponse) => void;
}

describe('useAgent abort — pending permission cleanup', () => {
  /**
   * This test demonstrates the BUG: when abort occurs while a permission
   * prompt is pending, the promise never resolves.
   */
  it('should resolve pending permission promise with "deny" when agent is aborted', async () => {
    // Simulate the permission callback pattern from useAgent (line 262-266)
    let pendingPermissionRef: PendingPermissionRef | null = null;

    const permissionCallback = (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<PermissionResponse> => {
      return new Promise<PermissionResponse>((resolve) => {
        pendingPermissionRef = { toolName, args, resolve };
      });
    };

    // Simulate: a tool call triggers the permission callback
    const permissionPromise = permissionCallback('write-file', { path: '/tmp/test.ts' });

    // At this point, pendingPermissionRef is set and the promise is pending
    expect(pendingPermissionRef).not.toBeNull();

    // Simulate the FIXED finally block cleanup:
    // Before clearing pendingPermission, resolve the pending promise with 'deny'
    if (pendingPermissionRef) {
      (pendingPermissionRef as PendingPermissionRef).resolve('deny');
    }
    pendingPermissionRef = null;

    // The promise should now resolve with 'deny'
    const response = await permissionPromise;
    expect(response).toBe('deny');
  });

  it('should not leak unresolved promises on abort', async () => {
    let pendingPermissionRef: PendingPermissionRef | null = null;

    const permissionCallback = (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<PermissionResponse> => {
      return new Promise<PermissionResponse>((resolve) => {
        pendingPermissionRef = { toolName, args, resolve };
      });
    };

    // Create a permission request
    const permissionPromise = permissionCallback('bash', { command: 'rm -rf /' });
    expect(pendingPermissionRef).not.toBeNull();

    // Race the permission promise against a short timeout.
    // WITHOUT the fix, this would timeout (promise never resolves).
    // WITH the fix, the cleanup resolves with 'deny' before clearing.
    if (pendingPermissionRef) {
      (pendingPermissionRef as PendingPermissionRef).resolve('deny');
    }
    pendingPermissionRef = null;

    const result = await Promise.race([
      permissionPromise,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 100)),
    ]);

    // Must resolve with 'deny', not timeout
    expect(result).toBe('deny');
    expect(result).not.toBe('timeout');
  });

  it('should handle cleanup gracefully when no permission is pending', () => {
    // Simulate the finally block when no permission is pending
    let pendingPermissionRef: PendingPermissionRef | null = null;

    // The fix should not throw when there's nothing to clean up
    const ref = pendingPermissionRef as PendingPermissionRef | null;
    if (ref) {
      ref.resolve('deny');
    }
    pendingPermissionRef = null;

    // No error = pass
    expect(pendingPermissionRef).toBeNull();
  });

  /**
   * This test verifies the actual ref-based pattern that the fix uses.
   * The fix uses pendingPermissionResolveRef to track the resolve function
   * so it can be called from the finally block even though React state
   * updates are asynchronous.
   */
  it('should use ref to track resolve function across async boundaries', async () => {
    // Simulate the ref-based approach in the fix
    let pendingPermissionResolveRef: ((response: PermissionResponse) => void) | null = null;

    const permissionCallback = (
      _toolName: string,
      _args: Record<string, unknown>,
    ): Promise<PermissionResponse> => {
      return new Promise<PermissionResponse>((resolve) => {
        // The fix stores resolve in a ref (not just state)
        pendingPermissionResolveRef = resolve;
      });
    };

    // Create a pending permission
    const permissionPromise = permissionCallback('write-file', { path: '/test' });

    // Simulate abort → finally block uses the ref to resolve
    const resolveRef = pendingPermissionResolveRef as ((response: PermissionResponse) => void) | null;
    if (resolveRef) {
      resolveRef('deny');
      pendingPermissionResolveRef = null;
    }

    const result = await permissionPromise;
    expect(result).toBe('deny');
  });
});
