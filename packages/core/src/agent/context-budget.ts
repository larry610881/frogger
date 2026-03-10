import type { ModelMessage } from 'ai';
import type { ModelInfo } from '@frogger/shared';
import { DEFAULT_COMPACT_THRESHOLD } from '@frogger/shared';
import { estimateTokens, estimateMessagesTokens } from './token-estimator.js';

export interface ContextBudget {
  contextWindow: number;
  maxOutputTokens: number;
  /** (contextWindow - maxOutputTokens) * 0.9 — usable input capacity */
  availableInput: number;
  /** Estimated current token usage */
  currentUsage: number;
  /** 0-100 percentage */
  usagePercent: number;
  /** True when usagePercent >= compactThreshold */
  shouldCompact: boolean;
}

export class ContextBudgetTracker {
  private modelInfo: ModelInfo;
  private compactThreshold: number;

  constructor(modelInfo: ModelInfo, compactThreshold?: number) {
    this.modelInfo = modelInfo;
    this.compactThreshold = compactThreshold ?? DEFAULT_COMPACT_THRESHOLD;
  }

  /** Update model info (e.g. after /model switch) */
  setModelInfo(modelInfo: ModelInfo): void {
    this.modelInfo = modelInfo;
  }

  /** Update compact threshold (e.g. after /compact-threshold) */
  setCompactThreshold(threshold: number): void {
    this.compactThreshold = Math.max(10, Math.min(100, threshold));
  }

  getCompactThreshold(): number {
    return this.compactThreshold;
  }

  /** Evaluate current context usage */
  evaluate(messages: ModelMessage[], systemPrompt?: string): ContextBudget {
    const { contextWindow, maxOutputTokens } = this.modelInfo;
    const availableInput = Math.floor((contextWindow - maxOutputTokens) * 0.9);

    let currentUsage = estimateMessagesTokens(messages);
    if (systemPrompt) {
      currentUsage += estimateTokens(systemPrompt);
    }

    const usagePercent = availableInput > 0
      ? Math.min(100, Math.round((currentUsage / availableInput) * 100))
      : 0;

    return {
      contextWindow,
      maxOutputTokens,
      availableInput,
      currentUsage,
      usagePercent,
      shouldCompact: usagePercent >= this.compactThreshold,
    };
  }
}
