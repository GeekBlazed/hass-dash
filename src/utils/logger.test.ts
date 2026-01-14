import { describe, expect, it, vi } from 'vitest';

import { createLogger, getLogLevelFromEnv, normalizeLogLevel } from './logger';

describe('logger', () => {
  it('normalizeLogLevel accepts known values (case-insensitive)', () => {
    expect(normalizeLogLevel('DEBUG')).toBe('debug');
    expect(normalizeLogLevel(' info ')).toBe('info');
    expect(normalizeLogLevel('Warn')).toBe('warn');
    expect(normalizeLogLevel('error')).toBe('error');
    expect(normalizeLogLevel('silent')).toBe('silent');
  });

  it('normalizeLogLevel rejects unknown values', () => {
    expect(normalizeLogLevel('nope')).toBeNull();
    expect(normalizeLogLevel(undefined)).toBeNull();
  });

  it('getLogLevelFromEnv defaults to info in dev and warn in prod', () => {
    expect(getLogLevelFromEnv({}, true)).toBe('info');
    expect(getLogLevelFromEnv({}, false)).toBe('warn');
  });

  it('logger respects warn threshold', () => {
    const consoleLike = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      groupCollapsed: vi.fn(),
      groupEnd: vi.fn(),
      table: vi.fn(),
    };

    const logger = createLogger('test', {
      env: { VITE_LOG_LEVEL: 'warn' },
      isDev: true,
      console: consoleLike,
    });

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    logger.debugGroupCollapsed('group');
    logger.debugTable([{ x: 1 }]);
    logger.debugGroupEnd();

    expect(consoleLike.debug).not.toHaveBeenCalled();
    expect(consoleLike.info).not.toHaveBeenCalled();
    expect(consoleLike.warn).toHaveBeenCalledTimes(1);
    expect(consoleLike.error).toHaveBeenCalledTimes(1);
    expect(consoleLike.groupCollapsed).not.toHaveBeenCalled();
    expect(consoleLike.table).not.toHaveBeenCalled();
    expect(consoleLike.groupEnd).not.toHaveBeenCalled();
  });

  it('logger emits debug when configured', () => {
    const consoleLike = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      groupCollapsed: vi.fn(),
      groupEnd: vi.fn(),
      table: vi.fn(),
    };

    const logger = createLogger('test', {
      env: { VITE_LOG_LEVEL: 'debug' },
      isDev: true,
      console: consoleLike,
    });

    logger.debug('hello');
    logger.debugGroupCollapsed('group');
    logger.debugTable([{ x: 1 }]);
    logger.debugGroupEnd();

    expect(consoleLike.debug).toHaveBeenCalled();
    expect(consoleLike.groupCollapsed).toHaveBeenCalledWith('[test] group');
    expect(consoleLike.table).toHaveBeenCalled();
    expect(consoleLike.groupEnd).toHaveBeenCalled();
  });

  it('logger does not prefix messages when scope is empty', () => {
    const consoleLike = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      groupCollapsed: vi.fn(),
      groupEnd: vi.fn(),
      table: vi.fn(),
    };

    const logger = createLogger('', {
      env: { VITE_LOG_LEVEL: 'debug' },
      isDev: true,
      console: consoleLike,
    });

    logger.debug('hello');
    logger.debugGroupCollapsed('group');

    expect(consoleLike.debug).toHaveBeenCalledWith('hello');
    expect(consoleLike.groupCollapsed).toHaveBeenCalledWith('group');
  });
});
