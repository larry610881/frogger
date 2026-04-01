import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, setLogFormat, logger } from '../logger.js';

describe('createLogger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    setLogLevel('warn'); // Reset global level
    setLogFormat('text'); // Reset format
  });

  it('creates a logger that respects its own level', () => {
    const debugLogger = createLogger('debug');
    debugLogger.debug('test');
    expect(errorSpy).toHaveBeenCalledWith('[DEBUG] test');
  });

  it('logger with info level suppresses debug messages', () => {
    const infoLogger = createLogger('info');
    infoLogger.debug('should not appear');
    expect(errorSpy).not.toHaveBeenCalled();
    infoLogger.info('should appear');
    expect(errorSpy).toHaveBeenCalledWith('[INFO ] should appear');
  });

  it('logger without explicit level uses global level', () => {
    const defaultLogger = createLogger();
    setLogLevel('error');
    defaultLogger.warn('should not appear');
    expect(errorSpy).not.toHaveBeenCalled();
    defaultLogger.error('should appear');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] should appear');
  });

  it('default logger export is backward compatible', () => {
    setLogLevel('warn');
    logger.warn('test warning');
    expect(errorSpy).toHaveBeenCalledWith('[WARN ] test warning');
    logger.debug('hidden');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('json format outputs structured JSON', () => {
    setLogFormat('json');
    setLogLevel('debug');
    const jsonLogger = createLogger('debug');
    jsonLogger.warn('something happened');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('something happened');
    expect(parsed.timestamp).toBeDefined();
  });

  it('text format is unchanged after switching back from json', () => {
    setLogFormat('json');
    setLogFormat('text');
    setLogLevel('warn');
    logger.warn('back to text');
    expect(errorSpy).toHaveBeenCalledWith('[WARN ] back to text');
  });
});
