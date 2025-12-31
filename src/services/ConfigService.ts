import { injectable } from 'inversify';
import type { IConfigService } from '../interfaces/IConfigService';

/**
 * Configuration Service Implementation
 *
 * Provides access to environment variables and feature flags.
 * This is a simple implementation that reads from Vite's import.meta.env.
 */
@injectable()
export class ConfigService implements IConfigService {
  /**
   * Get the application version from environment variables
   * Defaults to '0.1.0' if not set
   */
  getAppVersion(): string {
    return import.meta.env.VITE_APP_VERSION || '0.1.0';
  }

  /**
   * Check if a feature flag is enabled
   * Feature flags are prefixed with VITE_FEATURE_ in the environment
   *
   * @param flag - The feature flag name (without the VITE_FEATURE_ prefix)
   * @returns true if the feature is enabled
   */
  isFeatureEnabled(flag: string): boolean {
    const envKey = `VITE_FEATURE_${flag.toUpperCase()}`;
    const value = import.meta.env[envKey];
    return value === 'true' || value === true;
  }

  /**
   * Get a configuration value by key
   * Keys are automatically prefixed with VITE_ if not already prefixed
   *
   * @param key - The configuration key
   * @returns The configuration value or undefined
   */
  getConfig(key: string): string | undefined {
    const envKey = key.startsWith('VITE_') ? key : `VITE_${key}`;
    const value = import.meta.env[envKey];
    return value !== undefined ? String(value) : undefined;
  }
}
