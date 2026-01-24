import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useDevToolsStore } from './useDevToolsStore';

describe('useDevToolsStore', () => {
  const originalUrl = window.location.href;
  const originalRelativeUrl = (() => {
    try {
      const url = new URL(originalUrl);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    } catch {
      return '/';
    }
  })();
  const originalURL = globalThis.URL;
  const originalURLSearchParams = globalThis.URLSearchParams;

  beforeEach(async () => {
    await useDevToolsStore.persist.clearStorage();
    useDevToolsStore.setState({ debugPanelOpen: false });
    try {
      window.history.replaceState({}, '', '/');
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    globalThis.URL = originalURL;
    globalThis.URLSearchParams = originalURLSearchParams;
    try {
      window.history.replaceState({}, '', originalRelativeUrl);
    } catch {
      // ignore
    }
  });

  it('sets and clears the debug query param', () => {
    useDevToolsStore.getState().setDebugPanelOpen(true);

    expect(useDevToolsStore.getState().debugPanelOpen).toBe(true);
    expect(new URLSearchParams(window.location.search).get('debug')).toBe('1');

    useDevToolsStore.getState().setDebugPanelOpen(false);
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(false);
    expect(new URLSearchParams(window.location.search).has('debug')).toBe(false);
  });

  it('toggleDebugPanel updates state and URL', () => {
    useDevToolsStore.getState().toggleDebugPanel();
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(true);
    expect(new URLSearchParams(window.location.search).get('debug')).toBe('1');

    useDevToolsStore.getState().toggleDebugPanel();
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(false);
    expect(new URLSearchParams(window.location.search).has('debug')).toBe(false);
  });

  it('syncFromUrl reads debug param, and falls back on parse errors', () => {
    window.history.replaceState({}, '', '/?debug=1');
    useDevToolsStore.getState().syncFromUrl();
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(true);

    globalThis.URLSearchParams = class {
      constructor() {
        throw new Error('boom');
      }

      has(): boolean {
        return false;
      }
    } as unknown as typeof URLSearchParams;

    useDevToolsStore.getState().syncFromUrl();
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(false);
  });

  it('setDebugPanelOpen does not throw if URL parsing fails', () => {
    globalThis.URL = class {
      constructor() {
        throw new Error('boom');
      }
    } as unknown as typeof URL;

    useDevToolsStore.getState().setDebugPanelOpen(true);
    expect(useDevToolsStore.getState().debugPanelOpen).toBe(true);
  });
});
