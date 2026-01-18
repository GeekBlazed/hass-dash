import { describe, expect, it, vi } from 'vitest';

import { getTrackingShowConfidenceWhenLessThan } from './trackingShowConfidenceConfig';

describe('getTrackingShowConfidenceWhenLessThan', () => {
  it('returns undefined when env var is empty', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '');
    expect(getTrackingShowConfidenceWhenLessThan()).toBeUndefined();
  });

  it('returns undefined when env var is not a number', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', 'nope');
    expect(getTrackingShowConfidenceWhenLessThan()).toBeUndefined();
  });

  it('parses a valid numeric threshold', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '90');
    expect(getTrackingShowConfidenceWhenLessThan()).toBe(90);
  });

  it('supports inline comments', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '90 # percent');
    expect(getTrackingShowConfidenceWhenLessThan()).toBe(90);
  });

  it('supports decimals', () => {
    vi.stubEnv('VITE_TRACKING_SHOW_CONFIDENCE_WHEN_LESS_THAN', '89.5; trailing comment');
    expect(getTrackingShowConfidenceWhenLessThan()).toBe(89.5);
  });
});
