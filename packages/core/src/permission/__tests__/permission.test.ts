import { describe, it, expect, vi } from 'vitest';
import { PermissionManager } from '../permission.js';
import type { PermissionCallback } from '../permission.js';

describe('PermissionManager', () => {
  it('always allows when policy is auto', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn();

    const result = await pm.check('write-file', {}, 'auto', 'confirm', cb);
    expect(result).toBe(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('allows auto-permission tools in confirm-writes policy', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn();

    const result = await pm.check('read-file', {}, 'confirm-writes', 'auto', cb);
    expect(result).toBe(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it('asks callback for confirm-permission tools in confirm-writes policy', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn().mockResolvedValue('allow');

    const result = await pm.check('write-file', { path: 'test.ts' }, 'confirm-writes', 'confirm', cb);
    expect(result).toBe(true);
    expect(cb).toHaveBeenCalledWith('write-file', { path: 'test.ts' });
  });

  it('asks callback for all tools in confirm-all policy', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn().mockResolvedValue('allow');

    const result = await pm.check('read-file', {}, 'confirm-all', 'auto', cb);
    expect(result).toBe(true);
    expect(cb).toHaveBeenCalled();
  });

  it('denies when callback returns deny', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn().mockResolvedValue('deny');

    const result = await pm.check('bash', { command: 'rm file' }, 'confirm-writes', 'confirm', cb);
    expect(result).toBe(false);
  });

  it('remembers always-allowed tools', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn().mockResolvedValue('always-project');

    // First call: asks callback
    await pm.check('write-file', {}, 'confirm-writes', 'confirm', cb);
    expect(cb).toHaveBeenCalledTimes(1);

    // Second call: should not ask again
    const result = await pm.check('write-file', {}, 'confirm-writes', 'confirm', cb);
    expect(result).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('reset clears always-allowed set', async () => {
    const pm = new PermissionManager();
    const cb: PermissionCallback = vi.fn().mockResolvedValue('always-project');

    await pm.check('write-file', {}, 'confirm-writes', 'confirm', cb);
    pm.reset();

    // After reset, should ask again
    await pm.check('write-file', {}, 'confirm-writes', 'confirm', cb);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
