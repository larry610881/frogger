import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ProviderEntry } from '@frogger/shared';
import { findProvider } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Create a Vercel AI SDK provider from a ProviderEntry.
 * Returns a callable that accepts a modelId and returns a LanguageModel.
 */
export function createProvider(
  entry: ProviderEntry,
  options?: { apiKey?: string },
): (modelId: string) => LanguageModel {
  const apiKey = options?.apiKey ?? process.env[entry.envKey];

  switch (entry.type) {
    case 'anthropic':
      return createAnthropic({ apiKey });

    case 'openai':
      return createOpenAI({ apiKey });

    case 'openai-compatible': {
      const provider = createOpenAI({
        apiKey,
        baseURL: entry.baseURL,
      });
      // OpenAI-compatible providers only support Chat Completions API
      return (modelId: string) => provider.chat(modelId);
    }
  }
}

/**
 * Create a LanguageModel instance.
 *
 * Accepts either a ProviderEntry directly or a provider name string
 * (looked up from the registry).
 */
export function createModel(
  provider: ProviderEntry | string,
  modelId: string,
  options?: { apiKey?: string },
): LanguageModel {
  const entry = typeof provider === 'string'
    ? findProvider(provider)
    : provider;

  if (!entry) {
    throw new Error(`Provider "${provider}" not found in registry`);
  }

  const providerFn = createProvider(entry, options);
  logger.debug(`Model created — provider=${entry.name}, model=${modelId}`);
  return providerFn(modelId);
}
