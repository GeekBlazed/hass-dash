import { describe, expect, it, vi } from 'vitest';

import { getEspresenseMinConfidence } from './espresenseTrackingConfig';

describe('getEspresenseMinConfidence', () => {
  it('falls back to default 69 when env is missing/invalid', () => {
    vi.stubEnv('VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE', '');
    expect(getEspresenseMinConfidence()).toBe(69);

    vi.stubEnv('VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE', 'nope');
    expect(getEspresenseMinConfidence()).toBe(69);
  });

  it('uses env value when valid and preserves strict > boundary behavior downstream', () => {
    vi.stubEnv('VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE', '69');
    expect(getEspresenseMinConfidence()).toBe(69);

    vi.stubEnv('VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE', '70');
    expect(getEspresenseMinConfidence()).toBe(70);
  });
});
