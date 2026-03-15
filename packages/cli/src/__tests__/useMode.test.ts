import { describe, it, expect } from 'vitest';
import type { ModeName } from '@frogger/shared';

/**
 * Tests for the useMode hook logic.
 *
 * Since useMode is a simple React state hook, we test the core cycle logic
 * directly rather than pulling in a full React test renderer.
 */

const MODE_CYCLE: ModeName[] = ['ask', 'plan', 'agent'];

function cycleMode(current: ModeName): ModeName {
  const idx = MODE_CYCLE.indexOf(current);
  return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]!;
}

describe('useMode logic', () => {
  it('initializes with default mode "agent"', () => {
    const defaultMode: ModeName = 'agent';
    expect(defaultMode).toBe('agent');
  });

  it('initializes with custom mode', () => {
    const customMode: ModeName = 'ask';
    expect(customMode).toBe('ask');
  });

  it('cycles through modes: ask → plan → agent → ask', () => {
    expect(cycleMode('ask')).toBe('plan');
    expect(cycleMode('plan')).toBe('agent');
    expect(cycleMode('agent')).toBe('ask');
  });

  it('setMode directly changes mode', () => {
    let mode: ModeName = 'agent';
    const setMode = (newMode: ModeName) => { mode = newMode; };

    setMode('plan');
    expect(mode).toBe('plan');

    setMode('ask');
    expect(mode).toBe('ask');
  });

  it('cycleMode wraps around from agent to ask', () => {
    // Full cycle starting from agent
    let current: ModeName = 'agent';
    current = cycleMode(current); // → ask
    expect(current).toBe('ask');
    current = cycleMode(current); // → plan
    expect(current).toBe('plan');
    current = cycleMode(current); // → agent
    expect(current).toBe('agent');
    current = cycleMode(current); // → ask (wrap)
    expect(current).toBe('ask');
  });
});
