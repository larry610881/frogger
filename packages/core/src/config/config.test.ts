import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, loadProjectContext, loadProviders, findModelInfo } from './config.js';
import { DEFAULT_MODEL, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_OUTPUT_TOKENS } from '@frogger/shared';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FROGGER_PROVIDER;
    delete process.env.FROGGER_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns defaults when no options or env vars', () => {
    const config = loadConfig();
    expect(config.provider).toBe('deepseek');
    expect(config.model).toBe(DEFAULT_MODEL);
    // apiKey may come from ~/.frogger/config.json if it exists
  });

  it('uses CLI options over env vars', () => {
    process.env.FROGGER_PROVIDER = 'openai';
    process.env.FROGGER_MODEL = 'gpt-4o';
    const config = loadConfig({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-20250514');
  });

  it('uses env vars when no CLI options', () => {
    process.env.FROGGER_PROVIDER = 'openai';
    process.env.FROGGER_MODEL = 'gpt-4o';
    const config = loadConfig();
    expect(config.provider).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('picks ANTHROPIC_API_KEY for anthropic provider', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const config = loadConfig({ provider: 'anthropic' });
    expect(config.apiKey).toBe('sk-ant-test');
  });

  it('picks OPENAI_API_KEY for openai provider', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-test';
    const config = loadConfig({ provider: 'openai' });
    expect(config.apiKey).toBe('sk-openai-test');
  });

  it('picks DEEPSEEK_API_KEY for deepseek provider', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek-test';
    const config = loadConfig({ provider: 'deepseek' });
    expect(config.apiKey).toBe('sk-deepseek-test');
  });
});

describe('loadProviders', () => {
  it('returns default providers', () => {
    const providers = loadProviders();
    expect(providers.length).toBeGreaterThanOrEqual(3);
    expect(providers.map(p => p.name)).toContain('deepseek');
    expect(providers.map(p => p.name)).toContain('anthropic');
    expect(providers.map(p => p.name)).toContain('openai');
  });

  it('each provider has required fields', () => {
    const providers = loadProviders();
    for (const p of providers) {
      expect(p.name).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.type).toBeTruthy();
      expect(p.envKey).toBeTruthy();
      expect(p.models.length).toBeGreaterThan(0);
      expect(p.defaultModel).toBeTruthy();
    }
  });

  it('models have ModelInfo structure with contextWindow and maxOutputTokens', () => {
    const providers = loadProviders();
    for (const p of providers) {
      for (const m of p.models) {
        expect(m).toHaveProperty('name');
        expect(m).toHaveProperty('contextWindow');
        expect(m).toHaveProperty('maxOutputTokens');
        expect(typeof m.name).toBe('string');
        expect(typeof m.contextWindow).toBe('number');
        expect(typeof m.maxOutputTokens).toBe('number');
        expect(m.contextWindow).toBeGreaterThan(0);
        expect(m.maxOutputTokens).toBeGreaterThan(0);
      }
    }
  });
});

describe('findModelInfo', () => {
  it('returns model info for a known provider/model', () => {
    const info = findModelInfo('deepseek', 'deepseek-chat');
    expect(info.name).toBe('deepseek-chat');
    // contextWindow depends on whether providers.json is fresh (131072) or migrated from old format (128000)
    expect(info.contextWindow).toBeGreaterThanOrEqual(DEFAULT_CONTEXT_WINDOW);
    expect(info.maxOutputTokens).toBeGreaterThanOrEqual(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('returns defaults for unknown provider', () => {
    const info = findModelInfo('nonexistent', 'some-model');
    expect(info.name).toBe('some-model');
    expect(info.contextWindow).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(info.maxOutputTokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });

  it('returns defaults for unknown model within known provider', () => {
    const info = findModelInfo('deepseek', 'nonexistent-model');
    expect(info.name).toBe('nonexistent-model');
    expect(info.contextWindow).toBe(DEFAULT_CONTEXT_WINDOW);
    expect(info.maxOutputTokens).toBe(DEFAULT_MAX_OUTPUT_TOKENS);
  });
});

describe('loadProjectContext', () => {
  const testDir = join(tmpdir(), 'frogger-config-test-' + Date.now());

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('reads FROGGER.md from the working directory', async () => {
    await writeFile(join(testDir, 'FROGGER.md'), '# Test Project');
    const context = await loadProjectContext(testDir);
    expect(context).toBe('# Test Project');
  });

  it('returns undefined when FROGGER.md does not exist', async () => {
    const context = await loadProjectContext(testDir);
    expect(context).toBeUndefined();
  });
});
