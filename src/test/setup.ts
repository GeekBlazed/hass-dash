import { afterEach, beforeEach, vi } from 'vitest';

// Keep test output readable by default. Must run before modules under test
// create their (often module-scoped) loggers.
vi.stubEnv('VITE_LOG_LEVEL', 'silent');

let actFn: ((cb: () => Promise<void>) => Promise<void>) | undefined;
let cleanupFn: (() => void) | undefined;

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const rtl = await import('@testing-library/react');
  actFn = rtl.act;
  cleanupFn = rtl.cleanup;
}

// jsdom in this environment does not implement document.elementFromPoint, but
// some UI code (e.g. delegated SVG pointer handlers) uses it.
if (typeof document !== 'undefined') {
  // jsdom in this environment does not implement document.elementFromPoint, but
  // some UI code (e.g. delegated SVG pointer handlers) uses it.
  if (
    typeof (document as unknown as { elementFromPoint?: unknown }).elementFromPoint !== 'function'
  ) {
    (
      document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
    ).elementFromPoint = () => null;
  }
}

if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key' | 'length'>;

const createMemoryStorage = (): StorageLike => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),
    getItem: vi.fn((key: string) => {
      return store.get(String(key)) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(String(key), String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(String(key));
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

const ensureStorage = (key: 'localStorage' | 'sessionStorage'): void => {
  const candidate = (window as unknown as Record<string, unknown>)[key];
  const hasStorageApi =
    candidate &&
    typeof (candidate as Storage).getItem === 'function' &&
    typeof (candidate as Storage).setItem === 'function' &&
    typeof (candidate as Storage).removeItem === 'function' &&
    typeof (candidate as Storage).clear === 'function';

  if (hasStorageApi) return;

  Object.defineProperty(window, key, {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
};

beforeEach(() => {
  // Reset env stubs between tests, but keep logs quiet by default.
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_LOG_LEVEL', 'silent');

  if (typeof window === 'undefined') return;

  ensureStorage('localStorage');
  ensureStorage('sessionStorage');

  window.localStorage.clear();
  window.sessionStorage.clear();
});

// Cleanup after each test
afterEach(async () => {
  if (actFn) {
    // Many components (e.g. dashboard data loading) schedule microtask-based
    // state updates after initial render. Flush them inside act() to avoid
    // noisy "not wrapped in act(...)" warnings.
    await actFn(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  cleanupFn?.();
  vi.clearAllMocks();
});
