import { describe, expect, it, vi } from 'vitest';

import { getTrackingStaleTimeoutMs } from './trackingStaleTimeoutConfig';

describe('getTrackingStaleTimeoutMs', () => {
  it('defaults to 30 minutes when env is missing/invalid', () => {
    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '');
    expect(getTrackingStaleTimeoutMs()).toBe(30 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', 'nope');
    expect(getTrackingStaleTimeoutMs()).toBe(30 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '0');
    expect(getTrackingStaleTimeoutMs()).toBe(30 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '-5');
    expect(getTrackingStaleTimeoutMs()).toBe(30 * 60_000);
  });

  it('parses minutes (including inline comments)', () => {
    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '45');
    expect(getTrackingStaleTimeoutMs()).toBe(45 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '15 # minutes');
    expect(getTrackingStaleTimeoutMs()).toBe(15 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '2.5; trailing comment');
    expect(getTrackingStaleTimeoutMs()).toBe(2.5 * 60_000);
  });
});
