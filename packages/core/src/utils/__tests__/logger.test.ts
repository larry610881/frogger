import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, logger } from '../logger.js';

describe('createLogger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    setLogLevel('warn'); // Reset global level
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
});
