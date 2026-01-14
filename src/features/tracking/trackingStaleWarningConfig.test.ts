import { describe, expect, it, vi } from 'vitest';

import { getTrackingStaleWarningMs } from './trackingStaleWarningConfig';

describe('getTrackingStaleWarningMs', () => {
  it('defaults to 10 minutes when env is missing/invalid', () => {
    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '');
    expect(getTrackingStaleWarningMs()).toBe(10 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', 'nope');
    expect(getTrackingStaleWarningMs()).toBe(10 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '0');
    expect(getTrackingStaleWarningMs()).toBe(10 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '-5');
    expect(getTrackingStaleWarningMs()).toBe(10 * 60_000);
  });

  it('parses minutes (including inline comments)', () => {
    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '20');
    expect(getTrackingStaleWarningMs()).toBe(20 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '15 # minutes');
    expect(getTrackingStaleWarningMs()).toBe(15 * 60_000);

    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '2.5; trailing comment');
    expect(getTrackingStaleWarningMs()).toBe(2.5 * 60_000);
  });
});
