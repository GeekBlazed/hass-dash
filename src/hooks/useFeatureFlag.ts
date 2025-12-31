import { useMemo } from 'react';
import { container } from '../core/di-container';
import { TYPES } from '../core/types';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';

/**
 * Custom React hook for feature flags
 * 
 * Provides a simple interface to check if features are enabled.
 * The service is retrieved from the DI container as a singleton.
 * 
 * @param flag - The feature flag name (e.g., 'FLOOR_PLAN', 'HA_CONNECTION')
 * @returns Object containing isEnabled boolean and the flag service
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isEnabled } = useFeatureFlag('FLOOR_PLAN');
 *   
 *   if (!isEnabled) return null;
 *   
 *   return <FloorPlan />;
 * }
 * ```
 */
export function useFeatureFlag(flag: string) {
  // Get the feature flag service from DI container
  // Using useMemo to ensure we only get it once per component lifecycle
  const featureFlagService = useMemo(
    () => container.get<IFeatureFlagService>(TYPES.IFeatureFlagService),
    []
  );

  // Check if the specific flag is enabled
  const isEnabled = featureFlagService.isEnabled(flag);

  return {
    isEnabled,
    service: featureFlagService,
  };
}

/**
 * Custom React hook to get all feature flags
 * 
 * Returns all feature flags and their current states.
 * Useful for debug panels and feature flag management UI.
 * 
 * @returns Object containing all flags and the flag service
 * 
 * @example
 * ```tsx
 * function DebugPanel() {
 *   const { flags, service } = useFeatureFlags();
 *   
 *   return (
 *     <div>
 *       {Object.entries(flags).map(([name, enabled]) => (
 *         <div key={name}>
 *           {name}: {enabled ? 'ON' : 'OFF'}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeatureFlags() {
  // Get the feature flag service from DI container
  const featureFlagService = useMemo(
    () => container.get<IFeatureFlagService>(TYPES.IFeatureFlagService),
    []
  );

  // Get all flags
  const flags = featureFlagService.getAll();

  return {
    flags,
    service: featureFlagService,
  };
}
