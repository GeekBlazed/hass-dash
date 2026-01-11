export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

type ConsoleLike = Pick<
  Console,
  'debug' | 'info' | 'warn' | 'error' | 'log' | 'groupCollapsed' | 'groupEnd' | 'table'
>;

type LoggerOptions = {
  env?: Record<string, unknown>;
  isDev?: boolean;
  console?: ConsoleLike;
};

type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;

  debugGroupCollapsed: (label: string) => void;
  debugGroupEnd: () => void;
  debugTable: (tabularData: unknown) => void;
};

const levelToNumber: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export function normalizeLogLevel(value: unknown): LogLevel | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
    case 'silent':
      return normalized;
    default:
      return null;
  }
}

export function getLogLevelFromEnv(env: Record<string, unknown>, isDev: boolean): LogLevel {
  const configured = normalizeLogLevel(env.VITE_LOG_LEVEL);
  if (configured) return configured;

  // Default: avoid noisy logs, but allow useful info in dev.
  return isDev ? 'info' : 'warn';
}

export function createLogger(scope: string, options?: LoggerOptions): Logger {
  const consoleImpl: ConsoleLike = options?.console ?? console;
  const env: Record<string, unknown> =
    options?.env ?? (import.meta.env as unknown as Record<string, unknown>);
  const isDev: boolean = options?.isDev ?? Boolean(import.meta.env.DEV);

  const threshold = levelToNumber[getLogLevelFromEnv(env, isDev)];

  const shouldLog = (level: LogLevel): boolean => {
    return levelToNumber[level] >= threshold;
  };

  const withScope = (args: unknown[]): unknown[] => {
    return scope ? [`[${scope}]`, ...args] : args;
  };

  const scopedLabel = (label: string): string => {
    return scope ? `[${scope}] ${label}` : label;
  };

  return {
    debug: (...args) => {
      if (!shouldLog('debug')) return;
      consoleImpl.debug(...withScope(args));
    },
    info: (...args) => {
      if (!shouldLog('info')) return;
      consoleImpl.info(...withScope(args));
    },
    warn: (...args) => {
      if (!shouldLog('warn')) return;
      consoleImpl.warn(...withScope(args));
    },
    error: (...args) => {
      if (!shouldLog('error')) return;
      consoleImpl.error(...withScope(args));
    },

    debugGroupCollapsed: (label) => {
      if (!shouldLog('debug')) return;
      consoleImpl.groupCollapsed(scopedLabel(label));
    },
    debugGroupEnd: () => {
      if (!shouldLog('debug')) return;
      consoleImpl.groupEnd();
    },
    debugTable: (tabularData) => {
      if (!shouldLog('debug')) return;
      consoleImpl.table(tabularData);
    },
  };
}
