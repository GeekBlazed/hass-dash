/**
 * Feature flag service.
 *
 * Flags are expected to be defined as Vite env vars:
 * - VITE_FEATURE_<NAME>=true|false
 * - VITE_OVERLAY_<NAME>=true|false
 *
 * In non-production modes, flags may be overridden at runtime.
 */
export interface IFeatureFlagService {
  /**
   * Returns whether a flag is enabled.
   *
   * Accepted inputs:
   * - 'SOME_FLAG'               -> VITE_FEATURE_SOME_FLAG
   * - 'FEATURE_SOME_FLAG'       -> VITE_FEATURE_SOME_FLAG
   * - 'OVERLAY_LIGHTING'        -> VITE_OVERLAY_LIGHTING
   * - 'VITE_FEATURE_SOME_FLAG'  -> VITE_FEATURE_SOME_FLAG
   */
  isEnabled(flag: string): boolean;

  /** Returns the merged env + override view of all known flags. */
  getAll(): Record<string, boolean>;

  /** Enable a flag override (non-production only). */
  enable(flag: string): void;

  /** Disable a flag override (non-production only). */
  disable(flag: string): void;

  /** Subscribe to override changes (used by React hooks). */
  subscribe(listener: () => void): () => void;
}
