import type { ModeName, ModeConfig, ApprovalPolicy } from '@frogger/shared';
import { askMode } from './ask.js';
import { planMode } from './plan.js';
import { agentMode } from './agent.js';

const MODE_CYCLE: readonly ModeName[] = ['ask', 'plan', 'agent'] as const;

export class ModeManager {
  private currentMode: ModeName;
  private modes: Map<ModeName, ModeConfig>;
  private policyOverride?: ApprovalPolicy;

  constructor(initialMode: ModeName = 'agent', policyOverride?: ApprovalPolicy) {
    this.modes = new Map<ModeName, ModeConfig>([
      ['ask', askMode],
      ['plan', planMode],
      ['agent', agentMode],
    ]);
    this.currentMode = initialMode;
    this.policyOverride = policyOverride;
  }

  getCurrentMode(): ModeConfig {
    const mode = this.modes.get(this.currentMode)!;
    if (this.policyOverride) {
      return { ...mode, approvalPolicy: this.policyOverride };
    }
    return mode;
  }

  setMode(mode: ModeName): void {
    if (!this.modes.has(mode)) {
      throw new Error(`Unknown mode: ${mode}`);
    }
    this.currentMode = mode;
  }

  /** Cycle through modes: ask -> plan -> agent -> ask */
  cycle(): ModeName {
    const currentIndex = MODE_CYCLE.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
    this.currentMode = MODE_CYCLE[nextIndex];
    return this.currentMode;
  }
}
