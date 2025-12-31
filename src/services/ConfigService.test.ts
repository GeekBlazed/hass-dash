import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './ConfigService';

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  describe('getAppVersion', () => {
    it('should return version from environment variable', () => {
      const version = configService.getAppVersion();
      expect(version).toBe('0.1.0');
    });

    it('should return default version when env variable is not set', () => {
      // Store original value
      const originalEnv = import.meta.env.VITE_APP_VERSION;

      // Temporarily unset the env variable
      vi.stubEnv('VITE_APP_VERSION', undefined);

      const service = new ConfigService();
      const version = service.getAppVersion();

      expect(version).toBe('0.1.0');

      // Restore original value
      if (originalEnv !== undefined) {
        vi.stubEnv('VITE_APP_VERSION', originalEnv);
      } else {
        vi.unstubAllEnvs();
      }
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return false for disabled features', () => {
      const isEnabled = configService.isFeatureEnabled('FLOOR_PLAN');
      expect(isEnabled).toBe(false);
    });

    it('should return false for non-existent features', () => {
      const isEnabled = configService.isFeatureEnabled('NON_EXISTENT');
      expect(isEnabled).toBe(false);
    });

    it('should handle feature names in any case', () => {
      const isEnabledLower = configService.isFeatureEnabled('floor_plan');
      const isEnabledUpper = configService.isFeatureEnabled('FLOOR_PLAN');
      expect(isEnabledLower).toBe(false);
      expect(isEnabledUpper).toBe(false);
    });

    it('should return true when feature is enabled', () => {
      // Stub a feature as enabled
      vi.stubEnv('VITE_FEATURE_TEST', 'true');

      const service = new ConfigService();
      const isEnabled = service.isFeatureEnabled('TEST');

      expect(isEnabled).toBe(true);

      vi.unstubAllEnvs();
    });
  });

  describe('getConfig', () => {
    it('should return config value for existing key', () => {
      const version = configService.getConfig('APP_VERSION');
      expect(version).toBeDefined();
    });

    it('should return undefined for non-existent key', () => {
      const value = configService.getConfig('NON_EXISTENT_KEY');
      expect(value).toBeUndefined();
    });

    it('should handle keys with VITE_ prefix', () => {
      const value1 = configService.getConfig('VITE_APP_VERSION');
      const value2 = configService.getConfig('APP_VERSION');
      expect(value1).toBe(value2);
    });

    it('should return string values', () => {
      vi.stubEnv('VITE_TEST_CONFIG', 'test-value');

      const service = new ConfigService();
      const value = service.getConfig('TEST_CONFIG');

      expect(value).toBe('test-value');
      expect(typeof value).toBe('string');

      vi.unstubAllEnvs();
    });
  });
});
