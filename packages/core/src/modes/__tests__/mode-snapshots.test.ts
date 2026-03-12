import { describe, it, expect } from 'vitest';
import { askMode } from '../ask.js';
import { planMode } from '../plan.js';
import { agentMode } from '../agent.js';

describe('mode config snapshots', () => {
  it('ask mode config', () => {
    expect(askMode).toMatchSnapshot();
  });

  it('plan mode config', () => {
    expect(planMode).toMatchSnapshot();
  });

  it('agent mode config', () => {
    expect(agentMode).toMatchSnapshot();
  });
});
