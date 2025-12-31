/**
 * Feature Flag Service Interface
 * 
 * Provides access to feature flags for controlling application features.
 * Flags are read from environment variables prefixed with VITE_FEATURE_.
 */
export interface IFeatureFlagService {
  /**
   * Check if a specific feature flag is enabled
   * @param flag - The feature flag name (e.g., 'FLOOR_PLAN', 'HA_CONNECTION')
   * @returns true if the feature is enabled, false otherwise
   */
  isEnabled(flag: string): boolean;

  /**
   * Get all feature flags and their current states
   * @returns Record of flag names to boolean values
   */
  getAll(): Record<string, boolean>;

  /**
   * Enable a feature flag (development only)
   * This method should only be used in development/debug mode
   * @param flag - The feature flag name to enable
   */
  enable(flag: string): void;

  /**
   * Disable a feature flag (development only)
   * This method should only be used in development/debug mode
   * @param flag - The feature flag name to disable
   */
  disable(flag: string): void;
}
