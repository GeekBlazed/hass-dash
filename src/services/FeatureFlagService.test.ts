import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FeatureFlagService } from './FeatureFlagService';

describe('FeatureFlagService', () => {
  const withStubbedEnv = <T>(
    env: Record<string, string | undefined>,
    fn: (service: FeatureFlagService) => T
  ): T => {
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const service = new FeatureFlagService();

    try {
      return fn(service);
    } finally {
      vi.unstubAllEnvs();
    }
  };

  beforeEach(() => {
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
  });

  it('reads VITE_FEATURE_ flags by default', () => {
    withStubbedEnv({ VITE_FEATURE_FLOOR_PLAN: 'true' }, (service) => {
      expect(service.isEnabled('FLOOR_PLAN')).toBe(true);
      expect(service.isEnabled('FEATURE_FLOOR_PLAN')).toBe(true);
      expect(service.isEnabled('VITE_FEATURE_FLOOR_PLAN')).toBe(true);
    });
  });

  it('reads VITE_OVERLAY_ flags when using OVERLAY_ prefix', () => {
    withStubbedEnv({ VITE_OVERLAY_LIGHTING: 'true' }, (service) => {
      expect(service.isEnabled('OVERLAY_LIGHTING')).toBe(true);
      expect(service.isEnabled('VITE_OVERLAY_LIGHTING')).toBe(true);
    });
  });

  it('returns false when env var is unset', () => {
    const service = new FeatureFlagService();
    expect(service.isEnabled('SOME_MISSING_FLAG')).toBe(false);
  });

  it('supports runtime overrides in non-production modes', () => {
    withStubbedEnv({ VITE_FEATURE_FLOOR_PLAN: 'false' }, (service) => {
      expect(service.isEnabled('FLOOR_PLAN')).toBe(false);

      service.enable('FLOOR_PLAN');
      expect(service.isEnabled('FLOOR_PLAN')).toBe(true);

      service.disable('FLOOR_PLAN');
      expect(service.isEnabled('FLOOR_PLAN')).toBe(false);
    });
  });

  it('getAll returns merged env + overrides', () => {
    withStubbedEnv(
      {
        VITE_FEATURE_ALPHA: 'true',
        VITE_FEATURE_BETA: 'false',
        VITE_OVERLAY_LIGHTING: 'false',
      },
      (service) => {
        service.enable('BETA');
        service.enable('OVERLAY_LIGHTING');

        const all = service.getAll();

        expect(all.VITE_FEATURE_ALPHA).toBe(true);
        expect(all.VITE_FEATURE_BETA).toBe(true);
        expect(all.VITE_OVERLAY_LIGHTING).toBe(true);
      }
    );
  });
});
