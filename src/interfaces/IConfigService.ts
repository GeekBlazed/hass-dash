/**
 * Configuration Service Interface
 *
 * Provides access to application configuration including environment variables
 * and feature flags.
 */
export interface IConfigService {
  /**
   * Get the application version from environment variables
   * @returns The application version string
   */
  getAppVersion(): string;

  /**
   * Get a configuration value by key
   * @param key - The configuration key
   * @returns The configuration value or undefined if not found
   */
  getConfig(key: string): string | undefined;
}
