import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from './ConfigService';

describe('ConfigService', () => {
  const withStubbedEnv = <T>(
    env: Record<string, string | undefined>,
    fn: (service: ConfigService) => T
  ): T => {
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const service = new ConfigService();

    try {
      return fn(service);
    } finally {
      vi.unstubAllEnvs();
    }
  };

  beforeEach(() => {
    // Ensure test isolation even if a previous test forgot cleanup.
    vi.unstubAllEnvs();
  });

  describe('getAppVersion', () => {
    it('should return version from environment variable', () => {
      withStubbedEnv({ VITE_APP_VERSION: '9.9.9' }, (service) => {
        expect(service.getAppVersion()).toBe('9.9.9');
      });
    });

    it('should return default version when env variable is not set', () => {
      withStubbedEnv({ VITE_APP_VERSION: undefined }, (service) => {
        expect(service.getAppVersion()).toBe('0.1.0');
      });
    });
  });

  describe('getConfig', () => {
    it('should return config value for existing key', () => {
      withStubbedEnv({ VITE_APP_VERSION: '1.2.3' }, (service) => {
        expect(service.getConfig('APP_VERSION')).toBe('1.2.3');
      });
    });

    it('should return undefined for non-existent key', () => {
      const service = new ConfigService();
      expect(service.getConfig('NON_EXISTENT_KEY')).toBeUndefined();
    });

    it('should handle keys with VITE_ prefix', () => {
      withStubbedEnv({ VITE_APP_VERSION: '4.5.6' }, (service) => {
        const value1 = service.getConfig('VITE_APP_VERSION');
        const value2 = service.getConfig('APP_VERSION');
        expect(value1).toBe(value2);
      });
    });

    it('should return string values', () => {
      withStubbedEnv({ VITE_TEST_CONFIG: 'test-value' }, (service) => {
        const value = service.getConfig('TEST_CONFIG');
        expect(value).toBe('test-value');
        expect(typeof value).toBe('string');
      });
    });
  });
});
