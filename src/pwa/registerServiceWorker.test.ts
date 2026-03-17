import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from './registerServiceWorker';

describe('registerServiceWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
    globalThis.__VIRTUAL_REGISTER_SW__ = undefined;
  });

  it('returns early outside production when dev service worker is not explicitly enabled', () => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_PWA_DEV_SW', 'false');

    registerServiceWorker();

    expect(globalThis.__VIRTUAL_REGISTER_SW__).toBeUndefined();
  });

  it('returns early when lhci query param is present', () => {
    vi.stubEnv('PROD', true);
    window.history.replaceState({}, '', '/?lhci=1');

    registerServiceWorker();

    expect(globalThis.__VIRTUAL_REGISTER_SW__).toBeUndefined();
  });
});
