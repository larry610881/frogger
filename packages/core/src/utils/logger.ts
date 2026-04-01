export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'text' | 'json';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'warn';
let currentFormat: LogFormat = 'text';

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export function setLogFormat(format: LogFormat): void {
  currentFormat = format;
}

export function getLogFormat(): LogFormat {
  return currentFormat;
}

function formatMessage(level: LogLevel, message: string): string {
  if (currentFormat === 'json') {
    return JSON.stringify({ timestamp: new Date().toISOString(), level, message });
  }
  const tag = level.toUpperCase().padEnd(5);
  return `[${tag}] ${message}`;
}

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Create a logger instance with its own level.
 * Useful for subsystem-specific logging.
 */
export function createLogger(level?: LogLevel): Logger {
  const instanceLevel = level;

  function shouldLog(msgLevel: LogLevel): boolean {
    const effectiveLevel = instanceLevel ?? currentLevel;
    return LEVELS[msgLevel] >= LEVELS[effectiveLevel];
  }

  return {
    debug(message: string): void {
      if (shouldLog('debug')) console.error(formatMessage('debug', message));
    },
    info(message: string): void {
      if (shouldLog('info')) console.error(formatMessage('info', message));
    },
    warn(message: string): void {
      if (shouldLog('warn')) console.error(formatMessage('warn', message));
    },
    error(message: string): void {
      if (shouldLog('error')) console.error(formatMessage('error', message));
    },
  };
}

/** Default global logger instance. Uses the global log level. */
export const logger: Logger = createLogger();
