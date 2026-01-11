import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTrackingDebugOverlayMode } from './trackingDebugOverlayConfig';

describe('trackingDebugOverlayConfig', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to xyz when unset/invalid', () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', '');
    expect(getTrackingDebugOverlayMode()).toBe('xyz');

    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'nope');
    expect(getTrackingDebugOverlayMode()).toBe('xyz');
  });

  it('accepts geo and xyz', () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'geo');
    expect(getTrackingDebugOverlayMode()).toBe('geo');

    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'xyz');
    expect(getTrackingDebugOverlayMode()).toBe('xyz');
  });

  it('ignores inline comments in env values', () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'geo # Allowed: xyz | geo');
    expect(getTrackingDebugOverlayMode()).toBe('geo');

    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'xyz; trailing comment');
    expect(getTrackingDebugOverlayMode()).toBe('xyz');
  });
});
