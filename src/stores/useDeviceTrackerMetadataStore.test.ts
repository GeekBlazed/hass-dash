import { beforeEach, describe, expect, it } from 'vitest';

import { useDeviceTrackerMetadataStore } from './useDeviceTrackerMetadataStore';

describe('useDeviceTrackerMetadataStore', () => {
  beforeEach(() => {
    useDeviceTrackerMetadataStore.getState().clear();
  });

  it('does not overwrite existing values with undefined on upsert', () => {
    useDeviceTrackerMetadataStore.getState().setAll({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: 'phone:jeremy',
      },
    });

    useDeviceTrackerMetadataStore.getState().upsert('device_tracker.phone_jeremy', {
      name: undefined,
      alias: 'phone:jeremy',
    });

    const meta =
      useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy'];
    expect(meta?.name).toBe('Jeremy');
    expect(meta?.alias).toBe('phone:jeremy');
  });

  it('updates name when provided on upsert', () => {
    useDeviceTrackerMetadataStore.getState().setAll({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: 'phone:jeremy',
      },
    });

    useDeviceTrackerMetadataStore.getState().upsert('device_tracker.phone_jeremy', {
      name: 'Jeremy (new)',
    });

    const meta =
      useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy'];
    expect(meta?.name).toBe('Jeremy (new)');
    expect(meta?.alias).toBe('phone:jeremy');
  });
});
