import { describe, it, expect } from 'vitest';
import {
  resolveCapabilities,
  supportsCapability,
  DEFAULT_CAPABILITIES,
  type ProviderEntry,
} from '../types/providers.js';

function makeEntry(overrides: Partial<ProviderEntry>): ProviderEntry {
  return {
    name: 'test',
    label: 'Test',
    type: 'openai-compatible',
    envKey: 'TEST_KEY',
    models: [{ name: 'test-model', contextWindow: 128000, maxOutputTokens: 8192 }],
    defaultModel: 'test-model',
    ...overrides,
  };
}

describe('resolveCapabilities', () => {
  it('returns all true for anthropic', () => {
    const entry = makeEntry({ type: 'anthropic' });
    expect(resolveCapabilities(entry)).toEqual({
      vision: true,
      thinking: true,
      caching: true,
      toolUse: true,
    });
  });

  it('returns vision + toolUse true, thinking + caching false for openai', () => {
    const entry = makeEntry({ type: 'openai' });
    expect(resolveCapabilities(entry)).toEqual({
      vision: true,
      thinking: false,
      caching: false,
      toolUse: true,
    });
  });

  it('returns only toolUse true for openai-compatible', () => {
    const entry = makeEntry({ type: 'openai-compatible' });
    expect(resolveCapabilities(entry)).toEqual({
      vision: false,
      thinking: false,
      caching: false,
      toolUse: true,
    });
  });

  it('allows explicit overrides (e.g., openai-compatible with thinking: true)', () => {
    const entry = makeEntry({
      type: 'openai-compatible',
      capabilities: { thinking: true },
    });
    const caps = resolveCapabilities(entry);
    expect(caps.thinking).toBe(true);
    // other defaults unchanged
    expect(caps.vision).toBe(false);
    expect(caps.caching).toBe(false);
    expect(caps.toolUse).toBe(true);
  });

  it('allows overriding a default-true capability to false', () => {
    const entry = makeEntry({
      type: 'anthropic',
      capabilities: { caching: false },
    });
    const caps = resolveCapabilities(entry);
    expect(caps.caching).toBe(false);
    expect(caps.thinking).toBe(true);
    expect(caps.vision).toBe(true);
  });
});

describe('supportsCapability', () => {
  it('returns true for a supported capability', () => {
    const entry = makeEntry({ type: 'anthropic' });
    expect(supportsCapability(entry, 'thinking')).toBe(true);
  });

  it('returns false for an unsupported capability', () => {
    const entry = makeEntry({ type: 'openai' });
    expect(supportsCapability(entry, 'thinking')).toBe(false);
  });

  it('respects overrides', () => {
    const entry = makeEntry({
      type: 'openai-compatible',
      capabilities: { vision: true },
    });
    expect(supportsCapability(entry, 'vision')).toBe(true);
  });
});

describe('DEFAULT_CAPABILITIES', () => {
  it('has entries for all three provider types', () => {
    expect(DEFAULT_CAPABILITIES).toHaveProperty('anthropic');
    expect(DEFAULT_CAPABILITIES).toHaveProperty('openai');
    expect(DEFAULT_CAPABILITIES).toHaveProperty('openai-compatible');
  });
});

