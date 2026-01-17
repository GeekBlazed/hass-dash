import { useSyncExternalStore } from 'react';

import { TYPES } from '../core/types';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';
import { useService } from './useService';

export function useFeatureFlag(flag: string): { isEnabled: boolean; service: IFeatureFlagService } {
  const service = useService<IFeatureFlagService>(TYPES.IFeatureFlagService);

  const isEnabled = useSyncExternalStore(
    (listener) => service.subscribe(listener),
    () => service.isEnabled(flag),
    () => service.isEnabled(flag)
  );

  return { isEnabled, service };
}

export function useFeatureFlags(): {
  flags: Record<string, boolean>;
  service: IFeatureFlagService;
} {
  const service = useService<IFeatureFlagService>(TYPES.IFeatureFlagService);

  const flags = useSyncExternalStore(
    (listener) => service.subscribe(listener),
    () => service.getAll(),
    () => service.getAll()
  );

  return { flags, service };
}
