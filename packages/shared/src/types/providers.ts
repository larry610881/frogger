export type ProviderType = 'openai-compatible' | 'anthropic' | 'openai';

export interface ModelInfo {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
}

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
}

/** Provider types that support vision (image input) */
export const VISION_PROVIDER_TYPES: readonly ProviderType[] = ['anthropic', 'openai'] as const;

/** Check if a provider type supports vision (image input) */
export function supportsVision(providerType: ProviderType): boolean {
  return (VISION_PROVIDER_TYPES as readonly string[]).includes(providerType);
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
