import { describe, it, expect } from 'vitest';
import { ModeManager } from './manager.js';

describe('ModeManager', () => {
  it('defaults to agent mode', () => {
    const manager = new ModeManager();
    const mode = manager.getCurrentMode();
    expect(mode.name).toBe('agent');
    expect(mode.displayName).toBe('Agent');
  });

  it('accepts initial mode', () => {
    const manager = new ModeManager('ask');
    expect(manager.getCurrentMode().name).toBe('ask');
  });

  it('setMode switches to the specified mode', () => {
    const manager = new ModeManager();
    manager.setMode('plan');
    expect(manager.getCurrentMode().name).toBe('plan');
  });

  it('setMode throws for unknown mode', () => {
    const manager = new ModeManager();
    expect(() => manager.setMode('unknown' as any)).toThrow('Unknown mode: unknown');
  });

  it('cycle follows ask -> plan -> agent -> ask', () => {
    const manager = new ModeManager('ask');

    expect(manager.cycle()).toBe('plan');
    expect(manager.getCurrentMode().name).toBe('plan');

    expect(manager.cycle()).toBe('agent');
    expect(manager.getCurrentMode().name).toBe('agent');

    expect(manager.cycle()).toBe('ask');
    expect(manager.getCurrentMode().name).toBe('ask');
  });

  it('returns correct allowedTools for each mode', () => {
    const manager = new ModeManager();

    manager.setMode('ask');
    expect(manager.getCurrentMode().allowedTools).toEqual([
      'read-file',
      'glob',
      'grep',
      'list-files',
      'test-runner',
      'web-search',
      'analyze-repo',
    ]);

    manager.setMode('agent');
    expect(manager.getCurrentMode().allowedTools).toEqual([
      'read-file',
      'write-file',
      'edit-file',
      'bash',
      'glob',
      'grep',
      'list-files',
      'git-status',
      'git-diff',
      'git-log',
      'git-commit',
      'git-init',
      'git-branch',
      'git-remote',
      'git-push',
      'git-pull',
      'git-clone',
      'test-runner',
      'save-memory',
      'web-search',
      'gh-issue',
      'gh-pr',
      'analyze-repo',
    ]);
  });

  it('returns correct approvalPolicy for each mode', () => {
    const manager = new ModeManager();

    manager.setMode('ask');
    expect(manager.getCurrentMode().approvalPolicy).toBe('auto');

    manager.setMode('plan');
    expect(manager.getCurrentMode().approvalPolicy).toBe('auto');

    manager.setMode('agent');
    expect(manager.getCurrentMode().approvalPolicy).toBe('confirm-writes');
  });
});
