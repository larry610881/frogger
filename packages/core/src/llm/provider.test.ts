import { describe, it, expect } from 'vitest';
import { createProvider, createModel } from './provider.js';
import type { ProviderEntry } from '@frogger/shared';

const anthropicEntry: ProviderEntry = {
  name: 'anthropic',
  label: 'Anthropic',
  type: 'anthropic',
  envKey: 'ANTHROPIC_API_KEY',
  models: ['claude-sonnet-4-20250514'],
  defaultModel: 'claude-sonnet-4-20250514',
};

const openaiEntry: ProviderEntry = {
  name: 'openai',
  label: 'OpenAI',
  type: 'openai',
  envKey: 'OPENAI_API_KEY',
  models: ['gpt-4o'],
  defaultModel: 'gpt-4o',
};

const deepseekEntry: ProviderEntry = {
  name: 'deepseek',
  label: 'DeepSeek',
  type: 'openai-compatible',
  baseURL: 'https://api.deepseek.com',
  envKey: 'DEEPSEEK_API_KEY',
  models: ['deepseek-chat'],
  defaultModel: 'deepseek-chat',
};

describe('createProvider', () => {
  it('returns an anthropic provider', () => {
    const provider = createProvider(anthropicEntry, { apiKey: 'test-key' });
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
  });

  it('returns an openai provider', () => {
    const provider = createProvider(openaiEntry, { apiKey: 'test-key' });
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
  });
  it('returns a deepseek provider (openai-compatible)', () => {
    const provider = createProvider(deepseekEntry, { apiKey: 'test-key' });
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('function');
  });
});

describe('createModel', () => {
  it('returns a model instance for anthropic', () => {
    const model = createModel(anthropicEntry, 'claude-sonnet-4-20250514', {
      apiKey: 'test-key',
    });
    expect(model).toBeDefined();
    expect(model.modelId).toBe('claude-sonnet-4-20250514');
  });

  it('returns a model instance for openai', () => {
    const model = createModel(openaiEntry, 'gpt-4o', { apiKey: 'test-key' });
    expect(model).toBeDefined();
    expect(model.modelId).toBe('gpt-4o');
  });

  it('accepts a provider name string', () => {
    // Uses findProvider to look up from registry
    const model = createModel('deepseek', 'deepseek-chat', { apiKey: 'test-key' });
    expect(model).toBeDefined();
    expect(model.modelId).toBe('deepseek-chat');
  });
});
