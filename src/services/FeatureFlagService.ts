import { injectable } from 'inversify';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';

/**
 * Feature Flag Service Implementation
 *
 * Manages feature flags for the application. Flags are read from environment
 * variables prefixed with VITE_FEATURE_. Runtime overrides are stored in
 * sessionStorage for development purposes.
 */
@injectable()
export class FeatureFlagService implements IFeatureFlagService {
  private readonly STORAGE_KEY = 'feature_flag_overrides';
  private readonly FEATURE_PREFIX = 'VITE_FEATURE_';

  /**
   * Get runtime overrides from sessionStorage
   */
  private getOverrides(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};

    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * Save runtime overrides to sessionStorage
   */
  private saveOverrides(overrides: Record<string, boolean>): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(overrides));
  }

  /**
   * Check if a feature flag is enabled
   * Checks runtime overrides first, then environment variables
   */
  isEnabled(flag: string): boolean {
    const normalizedFlag = flag.toUpperCase().replace(/^VITE_FEATURE_/, '');

    // Check runtime overrides first
    const overrides = this.getOverrides();
    if (normalizedFlag in overrides) {
      return overrides[normalizedFlag];
    }

    // Fall back to environment variable
    const envKey = `${this.FEATURE_PREFIX}${normalizedFlag}`;
    const value = import.meta.env[envKey];

    if (typeof value === 'string') {
      return value.trim().toLowerCase() === 'true';
    }

    return value === true;
  }

  /**
   * Get all feature flags and their current states
   * Scans environment variables and merges with runtime overrides
   */
  getAll(): Record<string, boolean> {
    const flags: Record<string, boolean> = {};
    const overrides = this.getOverrides();

    // Get all environment variables starting with VITE_FEATURE_
    const env = import.meta.env;
    for (const key in env) {
      if (key.startsWith(this.FEATURE_PREFIX)) {
        const flagName = key.replace(this.FEATURE_PREFIX, '');
        flags[flagName] = this.isEnabled(flagName);
      }
    }

    // Add any override-only flags
    for (const flagName in overrides) {
      if (!(flagName in flags)) {
        flags[flagName] = overrides[flagName];
      }
    }

    return flags;
  }

  /**
   * Enable a feature flag at runtime (development only)
   * Changes are stored in sessionStorage and cleared on tab close
   */
  enable(flag: string): void {
    if (import.meta.env.PROD) {
      console.warn('Cannot toggle feature flags in production');
      return;
    }

    const normalizedFlag = flag.toUpperCase().replace(/^VITE_FEATURE_/, '');
    const overrides = this.getOverrides();
    overrides[normalizedFlag] = true;
    this.saveOverrides(overrides);
  }

  /**
   * Disable a feature flag at runtime (development only)
   * Changes are stored in sessionStorage and cleared on tab close
   */
  disable(flag: string): void {
    if (import.meta.env.PROD) {
      console.warn('Cannot toggle feature flags in production');
      return;
    }

    const normalizedFlag = flag.toUpperCase().replace(/^VITE_FEATURE_/, '');
    const overrides = this.getOverrides();
    overrides[normalizedFlag] = false;
    this.saveOverrides(overrides);
  }
}
