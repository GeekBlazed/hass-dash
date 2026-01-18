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
