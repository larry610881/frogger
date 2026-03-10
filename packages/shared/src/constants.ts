export const APP_VERSION = '0.1.9';
export const APP_NAME = 'frogger';
export const CONFIG_DIR = '.frogger';
export const PROJECT_FILE = 'FROGGER.md';
export const MAX_STEPS = 30;
export const DEFAULT_MODEL = 'deepseek-chat';
export const DEFAULT_PROVIDER = 'deepseek';

// Context window defaults
export const DEFAULT_CONTEXT_WINDOW = 128000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
export const DEFAULT_COMPACT_THRESHOLD = 80;
export const COMPACT_PRESERVE_RECENT = 4;

/** Maximum image file size for base64 encoding (5MB) */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

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
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};
