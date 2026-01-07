import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IEntityService } from '../interfaces/IEntityService';
import type { IHaSubscription } from '../interfaces/IHomeAssistantClient';
import { useDeviceLocationStore } from '../stores/useDeviceLocationStore';
import type { HaEntityState } from '../types/home-assistant';
import { DeviceLocationTrackingService } from './DeviceLocationTrackingService';

class FakeEntityService implements IEntityService {
  private handler: ((newState: HaEntityState) => void) | null = null;
  private active = true;

  public unsubscribeCalls = 0;

  async fetchStates(): Promise<HaEntityState[]> {
    return [];
  }

  async subscribeToStateChanges(
    handler: (newState: HaEntityState) => void
  ): Promise<IHaSubscription> {
    this.handler = handler;
    this.active = true;

    return {
      unsubscribe: async () => {
        this.unsubscribeCalls += 1;
        this.active = false;
      },
    };
  }

  emit(state: HaEntityState): void {
    if (!this.active) return;
    this.handler?.(state);
  }
}

describe('DeviceLocationTrackingService', () => {
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    useDeviceLocationStore.persist.clearStorage();
    useDeviceLocationStore.setState({ locationsByEntityId: {} });

    nowSpy?.mockRestore();
    nowSpy = null;
  });

  it('emitting a valid entity update causes a store update', async () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123);

    const entityService = new FakeEntityService();
    const service = new DeviceLocationTrackingService(
      entityService,
      {
        upsert: (entityId, location) => {
          useDeviceLocationStore.getState().upsert(entityId, location);
        },
      },
      69
    );

    await service.start();

    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 1,
        y: 2,
        z: 3,
        confidence: 70,
        last_seen: '2026-01-07T09:15:53.7063821Z',
      },
      last_changed: '2026-01-07T09:15:53Z',
      last_updated: '2026-01-07T09:15:53Z',
      context: { id: '1', parent_id: null, user_id: null },
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

  it('uses env-backed minConfidence by default (strict >)', async () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123);
    vi.stubEnv('VITE_TRACKING_ESPRESENSE_MIN_CONFIDENCE', '69');

    const entityService = new FakeEntityService();
    const service = new DeviceLocationTrackingService(entityService, {
      upsert: (entityId, location) => {
        useDeviceLocationStore.getState().upsert(entityId, location);
      },
    });

    await service.start();

    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 1,
        y: 2,
        confidence: 69,
      },
      last_changed: '2026-01-07T09:15:53Z',
      last_updated: '2026-01-07T09:15:53Z',
      context: { id: '1', parent_id: null, user_id: null },
    });

    expect(useDeviceLocationStore.getState().locationsByEntityId).toEqual({});

    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 1,
        y: 2,
        confidence: 70,
      },
      last_changed: '2026-01-07T09:15:54Z',
      last_updated: '2026-01-07T09:15:54Z',
      context: { id: '2', parent_id: null, user_id: null },
    });

    expect(
      useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
    ).toBeDefined();
  });

  it('low-confidence update does not update store', async () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123);

    const entityService = new FakeEntityService();
    const service = new DeviceLocationTrackingService(
      entityService,
      {
        upsert: (entityId, location) => {
          useDeviceLocationStore.getState().upsert(entityId, location);
        },
      },
      69
    );

    await service.start();

    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 1,
        y: 2,
        confidence: 69,
      },
      last_changed: '2026-01-07T09:15:53Z',
      last_updated: '2026-01-07T09:15:53Z',
      context: { id: '1', parent_id: null, user_id: null },
    });

    expect(useDeviceLocationStore.getState().locationsByEntityId).toEqual({});
  });

  it('stop()/unsubscribe prevents further updates', async () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1);

    const entityService = new FakeEntityService();
    const service = new DeviceLocationTrackingService(
      entityService,
      {
        upsert: (entityId, location) => {
          useDeviceLocationStore.getState().upsert(entityId, location);
        },
      },
      69
    );

    await service.start();

    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 1,
        y: 2,
        confidence: 70,
      },
      last_changed: '2026-01-07T09:15:53Z',
      last_updated: '2026-01-07T09:15:53Z',
      context: { id: '1', parent_id: null, user_id: null },
    });

    expect(
      useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
    ).toBeDefined();

    await service.stop();
    expect(entityService.unsubscribeCalls).toBe(1);

    nowSpy.mockReturnValue(2);
    entityService.emit({
      entity_id: 'device_tracker.phone_jeremy',
      state: 'home',
      attributes: {
        x: 9,
        y: 8,
        confidence: 99,
      },
      last_changed: '2026-01-07T09:15:54Z',
      last_updated: '2026-01-07T09:15:54Z',
      context: { id: '2', parent_id: null, user_id: null },
    });

    expect(
      useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']?.position
    ).toEqual({
      x: 1,
      y: 2,
    });
  });
});
