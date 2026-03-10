import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock node:fs BEFORE importing config (vi.mock is hoisted)
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Mock logger to capture warnings and suppress output
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { existsSync, readFileSync } from 'node:fs';
import { loadProviders } from './config.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_PROVIDERS } from '@frogger/shared';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockLoggerWarn = vi.mocked(logger.warn);

describe('loadProviders — Zod validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid providers.json correctly', () => {
    const validProviders = [
      {
        name: 'test-provider',
        label: 'Test Provider',
        type: 'openai-compatible',
        baseURL: 'https://api.test.com',
        envKey: 'TEST_API_KEY',
        models: [
          { name: 'test-model', contextWindow: 128000, maxOutputTokens: 4096 },
        ],
        defaultModel: 'test-model',
      },
    ];

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(validProviders));

    const result = loadProviders();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('test-provider');
    expect(result[0]!.label).toBe('Test Provider');
    expect(result[0]!.models[0]!.contextWindow).toBe(128000);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('falls back to defaults when providers.json has invalid structure (missing required field)', () => {
    const invalidProviders = [
      {
        name: 'bad-provider',
        // missing: label, type, envKey, models, defaultModel
      },
    ];

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(invalidProviders));

    const result = loadProviders();

    expect(result).toEqual(DEFAULT_PROVIDERS);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid providers.json'),
    );
  });

  it('falls back to defaults when providers.json contains malformed JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ this is not valid JSON!!!');

    const result = loadProviders();

    // Malformed JSON is caught by the existing try/catch
    expect(result).toEqual(DEFAULT_PROVIDERS);
  });

  it('strips extra fields (Zod default behavior)', () => {
    const providersWithExtra = [
      {
        name: 'test-provider',
        label: 'Test Provider',
        type: 'openai',
        envKey: 'TEST_API_KEY',
        models: [
          { name: 'test-model', contextWindow: 128000, maxOutputTokens: 4096 },
        ],
        defaultModel: 'test-model',
        extraField: 'should be stripped',
        anotherExtra: 42,
      },
    ];

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(providersWithExtra));

    const result = loadProviders();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('test-provider');
    // Extra fields should not be present on the validated output
    expect(result[0]).not.toHaveProperty('extraField');
    expect(result[0]).not.toHaveProperty('anotherExtra');
  });

  it('falls back to defaults when providers.json has wrong type for a field', () => {
    const wrongTypeProviders = [
      {
        name: 'test-provider',
        label: 'Test Provider',
        type: 'openai',
        envKey: 'TEST_API_KEY',
        models: 'not-an-array', // should be array
        defaultModel: 'test-model',
      },
    ];

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(wrongTypeProviders));

    const result = loadProviders();

    expect(result).toEqual(DEFAULT_PROVIDERS);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid providers.json'),
    );
  });

  it('falls back to defaults when providers.json has invalid provider type enum', () => {
    const invalidEnumProviders = [
      {
        name: 'test-provider',
        label: 'Test Provider',
        type: 'invalid-type', // not in enum
        envKey: 'TEST_API_KEY',
        models: [
          { name: 'test-model', contextWindow: 128000, maxOutputTokens: 4096 },
        ],
        defaultModel: 'test-model',
      },
    ];

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(invalidEnumProviders));

    const result = loadProviders();

    expect(result).toEqual(DEFAULT_PROVIDERS);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid providers.json'),
    );
  });

  it('falls back to defaults when providers.json is not an array', () => {
    const notAnArray = { name: 'single-object', label: 'Not Array' };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(notAnArray));

    const result = loadProviders();

    expect(result).toEqual(DEFAULT_PROVIDERS);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid providers.json'),
    );
  });
});
