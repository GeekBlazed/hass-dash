import { beforeEach, describe, expect, it } from 'vitest';

import { useDeviceLocationStore } from './useDeviceLocationStore';

const createInitialState = () => ({
  locationsByEntityId: {},
});

describe('useDeviceLocationStore', () => {
  beforeEach(() => {
    useDeviceLocationStore.persist.clearStorage();
    useDeviceLocationStore.setState(createInitialState());
  });

  it('upsert() inserts a new device location', () => {
    useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
      position: { x: 1, y: 2, z: 3 },
      confidence: 70,
      lastSeen: '2026-01-07T09:15:53.7063821Z',
      receivedAt: 123,
    });

    expect(
      useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
    ).toEqual({
      position: { x: 1, y: 2, z: 3 },
      confidence: 70,
      lastSeen: '2026-01-07T09:15:53.7063821Z',
      receivedAt: 123,
    });
  });

  it('upsert() overwrites the same entity id (latest wins)', () => {
    useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
      position: { x: 1, y: 2 },
      confidence: 70,
      lastSeen: undefined,
      receivedAt: 1,
    });

    useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
      position: { x: 9, y: 8 },
      confidence: 99,
      lastSeen: '2026-01-07T10:00:00Z',
      receivedAt: 2,
    });

    expect(
      useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
    ).toEqual({
      position: { x: 9, y: 8 },
      confidence: 99,
      lastSeen: '2026-01-07T10:00:00Z',
      receivedAt: 2,
    });
  });

  it('clear() resets state', () => {
    useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
      position: { x: 1, y: 2 },
      confidence: 70,
      lastSeen: undefined,
      receivedAt: 1,
    });

    expect(Object.keys(useDeviceLocationStore.getState().locationsByEntityId)).toHaveLength(1);

    useDeviceLocationStore.getState().clear();
    expect(useDeviceLocationStore.getState().locationsByEntityId).toEqual({});
  });
});
