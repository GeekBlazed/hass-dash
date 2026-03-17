import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppVersion } from './appVersion';

describe('getAppVersion', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_APP_VERSION', '');
    (globalThis as Record<string, unknown>).__APP_VERSION__ = undefined;
  });

  it('prefers VITE_APP_VERSION when set', () => {
    vi.stubEnv('VITE_APP_VERSION', ' 1.2.3 ');
    (globalThis as Record<string, unknown>).__APP_VERSION__ = '9.9.9';

    expect(getAppVersion()).toBe('1.2.3');
  });

  it('falls back to __APP_VERSION__ when env version is empty', () => {
    vi.stubEnv('VITE_APP_VERSION', '   ');
    (globalThis as Record<string, unknown>).__APP_VERSION__ = ' 2.4.6 ';

    expect(getAppVersion()).toBe('2.4.6');
  });

  it('returns default version when no configured version is usable', () => {
    vi.stubEnv('VITE_APP_VERSION', '');
    (globalThis as Record<string, unknown>).__APP_VERSION__ = '   ';

    expect(getAppVersion()).toBe('0.1.0');
  });
});
