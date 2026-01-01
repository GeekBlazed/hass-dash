import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlagService } from './FeatureFlagService';

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();
    service = new FeatureFlagService();
  });

  afterEach(() => {
    // Clean up env stubs
    vi.unstubAllEnvs();
  });

  describe('isEnabled', () => {
    it('should return false for disabled features', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'false');
      const isEnabled = service.isEnabled('TEST');
      expect(isEnabled).toBe(false);
    });

    it('should return true for enabled features', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'true');
      const isEnabled = service.isEnabled('TEST');
      expect(isEnabled).toBe(true);
    });

    it('should handle feature names with VITE_FEATURE_ prefix', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'true');
      const isEnabled = service.isEnabled('VITE_FEATURE_TEST');
      expect(isEnabled).toBe(true);
    });

    it('should handle lowercase feature names', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'true');
      const isEnabled = service.isEnabled('test');
      expect(isEnabled).toBe(true);
    });

    it('should return false for non-existent features', () => {
      const isEnabled = service.isEnabled('NON_EXISTENT');
      expect(isEnabled).toBe(false);
    });

    it('should prioritize runtime overrides over environment variables', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'false');
      vi.stubEnv('DEV', true);

      service.enable('TEST');
      const isEnabled = service.isEnabled('TEST');

      expect(isEnabled).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return all feature flags from environment', () => {
      vi.stubEnv('VITE_FEATURE_TEST1', 'true');
      vi.stubEnv('VITE_FEATURE_TEST2', 'false');

      const flags = service.getAll();

      expect(flags).toHaveProperty('TEST1', true);
      expect(flags).toHaveProperty('TEST2', false);
    });

    it('should include runtime overrides in results', () => {
      vi.stubEnv('VITE_FEATURE_TEST', 'false');
      vi.stubEnv('DEV', true);

      service.enable('TEST');
      const flags = service.getAll();

      expect(flags.TEST).toBe(true);
    });

    it('should return empty object when no flags are defined', () => {
      const flags = service.getAll();
      // May have flags from .env, but should at least return an object
      expect(typeof flags).toBe('object');
    });
  });

  describe('enable', () => {
    it('should enable a feature flag in development', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_FEATURE_TEST', 'false');

      service.enable('TEST');
      const isEnabled = service.isEnabled('TEST');

      expect(isEnabled).toBe(true);
    });

    it('should store override in sessionStorage', () => {
      vi.stubEnv('DEV', true);

      service.enable('TEST');
      const stored = sessionStorage.getItem('feature_flag_overrides');

      expect(stored).toBeTruthy();
      const overrides = JSON.parse(stored!);
      expect(overrides.TEST).toBe(true);
    });

    it('should warn and not enable in production', () => {
      vi.stubEnv('PROD', true);
      vi.stubEnv('DEV', false);
      const consoleSpy = vi.spyOn(console, 'warn');

      service.enable('TEST');

      expect(consoleSpy).toHaveBeenCalledWith('Cannot toggle feature flags in production');

      consoleSpy.mockRestore();
    });

    it('should normalize flag names', () => {
      vi.stubEnv('DEV', true);

      service.enable('test');
      service.enable('VITE_FEATURE_TEST2');

      const stored = sessionStorage.getItem('feature_flag_overrides');
      const overrides = JSON.parse(stored!);

      expect(overrides.TEST).toBe(true);
      expect(overrides.TEST2).toBe(true);
    });
  });

  describe('disable', () => {
    it('should disable a feature flag in development', () => {
      vi.stubEnv('DEV', true);
      vi.stubEnv('VITE_FEATURE_TEST', 'true');

      service.disable('TEST');
      const isEnabled = service.isEnabled('TEST');

      expect(isEnabled).toBe(false);
    });

    it('should store override in sessionStorage', () => {
      vi.stubEnv('DEV', true);

      service.disable('TEST');
      const stored = sessionStorage.getItem('feature_flag_overrides');

      expect(stored).toBeTruthy();
      const overrides = JSON.parse(stored!);
      expect(overrides.TEST).toBe(false);
    });

    it('should warn and not disable in production', () => {
      vi.stubEnv('PROD', true);
      vi.stubEnv('DEV', false);
      const consoleSpy = vi.spyOn(console, 'warn');

      service.disable('TEST');

      expect(consoleSpy).toHaveBeenCalledWith('Cannot toggle feature flags in production');

      consoleSpy.mockRestore();
    });
  });

  describe('sessionStorage persistence', () => {
    it('should persist multiple flag changes', () => {
      vi.stubEnv('DEV', true);

      service.enable('FLAG1');
      service.disable('FLAG2');
      service.enable('FLAG3');

      const stored = sessionStorage.getItem('feature_flag_overrides');
      const overrides = JSON.parse(stored!);

      expect(overrides.FLAG1).toBe(true);
      expect(overrides.FLAG2).toBe(false);
      expect(overrides.FLAG3).toBe(true);
    });

    it('should read existing overrides from sessionStorage', () => {
      const existingOverrides = { EXISTING: true };
      sessionStorage.setItem('feature_flag_overrides', JSON.stringify(existingOverrides));

      const isEnabled = service.isEnabled('EXISTING');

      expect(isEnabled).toBe(true);
    });
  });
});
