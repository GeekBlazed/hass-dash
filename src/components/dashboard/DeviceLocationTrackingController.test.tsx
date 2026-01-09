import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { IEntityService } from '../../interfaces/IEntityService';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';

describe('DeviceLocationTrackingController', () => {
  it('subscribes on mount and unsubscribes on unmount when flags enabled', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async () => ({
      unsubscribe,
    }));

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    // allow the effect to run
    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
