import { useState, useCallback, useRef } from 'react';
import type { ModelMessage } from 'ai';
import type { ContextBudget } from '@frogger/core';
import { COMPACT_PRESERVE_RECENT } from '@frogger/shared';
import type { ChatMessage } from '../utils/format.js';

interface UseContextBudgetOptions {
  provider: string;
  model?: string;
  messagesRef: React.MutableRefObject<ModelMessage[]>;
  ensureInitialized: () => Promise<{ budgetTracker: import('@frogger/core').ContextBudgetTracker }>;
  onMessage: (msg: ChatMessage) => void;
}

/**
 * Manages context budget tracking and auto-compact logic.
 */
export function useContextBudget(options: UseContextBudgetOptions) {
  const { messagesRef, ensureInitialized, onMessage } = options;
  const [contextBudget, setContextBudget] = useState<ContextBudget | null>(null);
  const lastCompactedAtRef = useRef(0);

  const updateBudget = useCallback(async (systemPrompt?: string) => {
    const { budgetTracker } = await ensureInitialized();
    const budget = budgetTracker.evaluate(messagesRef.current, systemPrompt);
    setContextBudget(budget);
    return budget;
  }, [ensureInitialized, messagesRef]);

  const maybeAutoCompact = useCallback(async (systemPrompt?: string) => {
    const budget = await updateBudget(systemPrompt);
    if (!budget.shouldCompact) return;
    if (messagesRef.current.length <= COMPACT_PRESERVE_RECENT) return;

    // Throttle: don't compact more than once per 30 seconds
    const now = Date.now();
    if (now - lastCompactedAtRef.current < 30000) return;

    try {
      const { compactMessages, loadConfig, createModel } = await import('@frogger/core');
      const config = loadConfig({ provider: options.provider, model: options.model });
      const model = createModel(config.provider, config.model, { apiKey: config.apiKey });

      const result = await compactMessages(model, messagesRef.current);
      messagesRef.current = result.messages;
      lastCompactedAtRef.current = Date.now();

      onMessage({
        id: `compact-${Date.now()}`,
        role: 'tool',
        content: `Auto-compacted ${result.compactedCount} messages.`,
      });

      await updateBudget(systemPrompt);
    } catch {
      // Silently fail auto-compact — not critical
    }
  }, [options.provider, options.model, messagesRef, onMessage, updateBudget]);

  return { contextBudget, updateBudget, maybeAutoCompact };
}
