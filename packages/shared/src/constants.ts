declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.9';
export const APP_NAME = 'frogger';
export const CONFIG_DIR = '.frogger';
export const AUDIT_DIR = 'audit';
export const PROJECT_FILE = 'FROGGER.md';
export const MAX_STEPS = 50;
export const DEFAULT_MODEL = 'deepseek-chat';
export const DEFAULT_PROVIDER = 'deepseek';

// Context window defaults
export const DEFAULT_CONTEXT_WINDOW = 128000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
export const DEFAULT_COMPACT_THRESHOLD = 80;
export const COMPACT_PRESERVE_RECENT = 4;

/** Maximum total size of rules content injected into system prompt (50KB) */
export const MAX_RULES_SIZE = 50_000;

/** Maximum memory file size before truncation (~50KB) */
export const MAX_MEMORY_SIZE = 50_000;

/** Maximum tool result size passed to hook env vars (100KB) */
export const MAX_TOOL_RESULT_SIZE = 100_000;

/** Maximum image file size for base64 encoding (5MB) */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

/** Minimum task duration (ms) before sending desktop notification */
export const NOTIFICATION_MIN_DURATION_MS = 15_000;

/** Maximum concurrent background tasks */
export const MAX_BACKGROUND_TASKS = 5;

/** Supported image file extensions for multimodal input */
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

/** IANA media types for image extensions */
export const IMAGE_MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** Model pricing: cost per 1M tokens in USD */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Anthropic — Claude 4.6
  'claude-opus-4-6': { input: 5.00, output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  // Anthropic — Claude 4.5
  'claude-opus-4-5-20251101': { input: 5.00, output: 25.00 },
  'claude-opus-4-5': { input: 5.00, output: 25.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00 },
  // Anthropic — Claude 4.1 (legacy)
  'claude-opus-4-1-20250805': { input: 15.00, output: 75.00 },
  'claude-opus-4-1': { input: 15.00, output: 75.00 },
  // Anthropic — Claude 4 (legacy)
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  // OpenAI — GPT-4.1
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  // OpenAI — Reasoning
  'o1': { input: 15.00, output: 60.00 },
  'o3': { input: 2.00, output: 8.00 },
  'o4-mini': { input: 1.10, output: 4.40 },
  // OpenAI — GPT-4o (legacy)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'o3-mini': { input: 1.10, output: 4.40 },
};
