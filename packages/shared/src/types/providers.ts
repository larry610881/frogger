export type ProviderType = 'openai-compatible' | 'anthropic' | 'openai';

export interface ModelInfo {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface ProviderCapabilities {
  vision: boolean;
  thinking: boolean;
  caching: boolean;
  toolUse: boolean;
}

export const DEFAULT_CAPABILITIES: Record<ProviderType, ProviderCapabilities> = {
  anthropic: { vision: true, thinking: true, caching: true, toolUse: true },
  openai: { vision: true, thinking: false, caching: false, toolUse: true },
  'openai-compatible': { vision: false, thinking: false, caching: false, toolUse: true },
};

export interface ProviderEntry {
  /** Unique identifier e.g. "deepseek" */
  name: string;
  /** Display name e.g. "DeepSeek" */
  label: string;
  /** SDK type determines how to create the provider */
  type: ProviderType;
  /** Base URL for openai-compatible providers */
  baseURL?: string;
  /** Environment variable name for the API key */
  envKey: string;
  /** Available models with context window info */
  models: ModelInfo[];
  /** Default model to use */
  defaultModel: string;
  /** Per-provider capability overrides */
  capabilities?: Partial<ProviderCapabilities>;
}

/** Resolve full capabilities for a provider entry, merging defaults with overrides */
export function resolveCapabilities(entry: ProviderEntry): ProviderCapabilities {
  const defaults = DEFAULT_CAPABILITIES[entry.type];
  return { ...defaults, ...entry.capabilities };
}

/** Check if a provider entry supports a specific capability */
export function supportsCapability(entry: ProviderEntry, key: keyof ProviderCapabilities): boolean {
  return resolveCapabilities(entry)[key];
}

export const DEFAULT_PROVIDERS: ProviderEntry[] = [
  {
    name: 'deepseek',
    label: 'DeepSeek',
    type: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { name: 'deepseek-chat', contextWindow: 131072, maxOutputTokens: 8192 },
      { name: 'deepseek-reasoner', contextWindow: 131072, maxOutputTokens: 16384 },
    ],
    defaultModel: 'deepseek-chat',
  },
  {
    name: 'anthropic',
    label: 'Anthropic (Claude)',
    type: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { name: 'claude-sonnet-4-20250514', contextWindow: 200000, maxOutputTokens: 16384 },
      { name: 'claude-opus-4-20250514', contextWindow: 200000, maxOutputTokens: 16384 },
    ],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    name: 'openai',
    label: 'OpenAI',
    type: 'openai',
    envKey: 'OPENAI_API_KEY',
    models: [
      { name: 'gpt-4o', contextWindow: 128000, maxOutputTokens: 16384 },
      { name: 'gpt-4o-mini', contextWindow: 128000, maxOutputTokens: 16384 },
      { name: 'o3-mini', contextWindow: 200000, maxOutputTokens: 100000 },
    ],
    defaultModel: 'gpt-4o',
  },
];
