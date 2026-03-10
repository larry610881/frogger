import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { PROJECT_FILE, DEFAULT_MODEL, DEFAULT_PROVIDER, CONFIG_DIR, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_OUTPUT_TOKENS } from '@frogger/shared';
import type { ProviderEntry, ModelInfo } from '@frogger/shared';
import { DEFAULT_PROVIDERS } from '@frogger/shared';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Zod schemas for runtime validation of providers.json
// ---------------------------------------------------------------------------

const modelInfoSchema = z.object({
  name: z.string(),
  contextWindow: z.number(),
  maxOutputTokens: z.number(),
});

const providerEntrySchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(['openai-compatible', 'anthropic', 'openai']),
  baseURL: z.string().optional(),
  envKey: z.string(),
  models: z.array(modelInfoSchema),
  defaultModel: z.string(),
});

const providersSchema = z.array(providerEntrySchema);

export interface FroggerConfig {
  provider: string;
  model: string;
  apiKey?: string;
}

/** Shape of ~/.frogger/config.json */
interface ConfigFile {
  provider?: string;
  model?: string;
  apiKey?: string;
}

function getConfigDir(): string {
  return join(homedir(), CONFIG_DIR);
}

function getConfigPath(): string {
  return join(getConfigDir(), 'config.json');
}

function getProvidersPath(): string {
  return join(getConfigDir(), 'providers.json');
}

function readConfigFile(): ConfigFile {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ConfigFile;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

/** Migrate old string[] models format to ModelInfo[] */
function migrateModels(models: (string | ModelInfo)[]): ModelInfo[] {
  return models.map(m => {
    if (typeof m === 'string') {
      return { name: m, contextWindow: DEFAULT_CONTEXT_WINDOW, maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS };
    }
    return m;
  });
}

/** Migrate provider entries from old format if needed */
function migrateProvider(provider: ProviderEntry): ProviderEntry {
  if (provider.models.length > 0 && typeof provider.models[0] === 'string') {
    return { ...provider, models: migrateModels(provider.models as unknown as (string | ModelInfo)[]) };
  }
  return provider;
}

/** Load providers from ~/.frogger/providers.json. Creates default file if missing. */
export function loadProviders(): ProviderEntry[] {
  const providersPath = getProvidersPath();
  if (!existsSync(providersPath)) {
    // Synchronously write defaults so first call always returns data
    mkdirSync(getConfigDir(), { recursive: true });
    writeFileSync(providersPath, JSON.stringify(DEFAULT_PROVIDERS, null, 2) + '\n', 'utf-8');
    return [...DEFAULT_PROVIDERS];
  }
  try {
    const raw = readFileSync(providersPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = providersSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn(`Invalid providers.json: ${result.error.message}. Using defaults.`);
      return [...DEFAULT_PROVIDERS];
    }
    return (result.data as ProviderEntry[]).map(migrateProvider);
  } catch {
    return [...DEFAULT_PROVIDERS];
  }
}

/** Persist providers to ~/.frogger/providers.json */
export async function saveProviders(providers: ProviderEntry[]): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });
  await writeFile(getProvidersPath(), JSON.stringify(providers, null, 2) + '\n', 'utf-8');
}

/** Add a provider entry. Throws if name already exists. */
export async function addProvider(entry: ProviderEntry): Promise<void> {
  const providers = loadProviders();
  if (providers.some(p => p.name === entry.name)) {
    throw new Error(`Provider "${entry.name}" already exists`);
  }
  providers.push(entry);
  await saveProviders(providers);
}

/** Remove a provider by name. Throws if it's the currently configured provider or not found. */
export async function removeProvider(name: string): Promise<void> {
  const providers = loadProviders();
  const idx = providers.findIndex(p => p.name === name);
  if (idx === -1) {
    throw new Error(`Provider "${name}" not found`);
  }
  // Prevent removing the currently active provider
  const config = readConfigFile();
  if ((config.provider ?? DEFAULT_PROVIDER) === name) {
    throw new Error(`Cannot remove "${name}" — it is the currently active provider`);
  }
  providers.splice(idx, 1);
  await saveProviders(providers);
}

/** Find a provider entry by name. Returns undefined if not found. */
export function findProvider(name: string): ProviderEntry | undefined {
  return loadProviders().find(p => p.name === name);
}

/** Find model info for a given provider/model combo. Returns defaults if not found. */
export function findModelInfo(providerName: string, modelName: string): ModelInfo {
  const provider = findProvider(providerName);
  if (provider) {
    const model = provider.models.find(m => m.name === modelName);
    if (model) return model;
  }
  return { name: modelName, contextWindow: DEFAULT_CONTEXT_WINDOW, maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function loadConfig(options?: {
  provider?: string;
  model?: string;
}): FroggerConfig {
  const fileConfig = readConfigFile();

  // Priority: CLI args > env vars > config file > defaults
  const providerName = (
    options?.provider
    ?? process.env.FROGGER_PROVIDER
    ?? fileConfig.provider
    ?? DEFAULT_PROVIDER
  );

  const model = (
    options?.model
    ?? process.env.FROGGER_MODEL
    ?? fileConfig.model
    ?? DEFAULT_MODEL
  );

  // Look up envKey dynamically from provider registry
  const entry = findProvider(providerName);
  const envKey = entry?.envKey;

  // API key priority: env var (from registry envKey) > config file
  let apiKey: string | undefined;
  if (envKey) {
    apiKey = process.env[envKey];
  }
  // Fallback to config file apiKey
  if (!apiKey && fileConfig.apiKey) {
    apiKey = fileConfig.apiKey;
  }

  logger.debug(`Config loaded — provider=${providerName}, model=${model}, apiKey=${apiKey ? 'set' : 'unset'}`);
  return { provider: providerName, model, apiKey };
}

export async function saveConfig(config: ConfigFile): Promise<string> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });

  const configPath = getConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

  // Restrict permissions — config may contain API keys
  await chmod(configPath, 0o600);

  return configPath;
}

export function hasConfig(): boolean {
  return existsSync(getConfigPath());
}

export async function loadProjectContext(workingDirectory: string): Promise<string | undefined> {
  try {
    return await readFile(join(workingDirectory, PROJECT_FILE), 'utf-8');
  } catch {
    return undefined;
  }
}
