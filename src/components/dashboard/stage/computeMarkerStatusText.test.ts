import { describe, expect, it, vi } from 'vitest';

import type { DeviceLocation } from '../../../stores/useDeviceLocationStore';
import { computeMarkerStatusText } from './computeMarkerStatusText';

const createLocation = (overrides?: Partial<DeviceLocation>): DeviceLocation => {
  return {
    position: { x: 1, y: 2 },
    confidence: 80,
    lastSeen: undefined,
    receivedAt: Date.now(),
    ...overrides,
  };
};

describe('computeMarkerStatusText', () => {
  it('returns stale minutes when stale and ageMinutes > 0', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '90');

    const location = createLocation({ confidence: 10 });
    expect(computeMarkerStatusText(location, true, 3)).toBe('> 3 minutes');
  });

  it('returns null when confidence threshold is disabled', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '');

    const location = createLocation({ confidence: 10 });
    expect(computeMarkerStatusText(location, false, null)).toBeNull();
  });

  it('returns null when confidence is above threshold', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '50');

    const location = createLocation({ confidence: 80 });
    expect(computeMarkerStatusText(location, false, null)).toBeNull();
  });

  it('returns a rounded percent when confidence is below threshold', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '90');

    const location = createLocation({ confidence: 88.6 });
    expect(computeMarkerStatusText(location, false, null)).toBe('89%');
  });
});
