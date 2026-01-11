import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TYPES } from '../../core/types';
import * as useServiceModule from '../../hooks/useService';
import type { IEntityService } from '../../interfaces/IEntityService';
import { useDeviceLocationStore } from '../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../stores/useDeviceTrackerMetadataStore';
import type { HaEntityState } from '../../types/home-assistant';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';

describe('DeviceLocationTrackingController', () => {
  const forceDevMode = (): (() => void) => {
    const env = (import.meta as any).env as Record<string, unknown>;
    const prevDev = env.DEV;
    const prevProd = env.PROD;
    env.DEV = true;
    env.PROD = false;

    return () => {
      env.DEV = prevDev;
      env.PROD = prevProd;
    };
  };

  it('only upserts locations for device_trackers assigned to a person and removes them when unassigned', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceLocationStore.getState().clear();
    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);

    const fetchStates = vi.fn(async () => [
      {
        entity_id: 'person.jeremy',
        state: 'home',
        attributes: {
          friendly_name: 'Jeremy',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
        last_changed: '2026-01-11T00:00:00.000Z',
        last_updated: '2026-01-11T00:00:00.000Z',
        context: { id: 'test', parent_id: null, user_id: null },
      } satisfies HaEntityState,
    ]);

    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    // Emit a tracker location update. It should only be accepted because it's assigned.
    for (const h of handlers) {
      h({
        entity_id: 'device_tracker.phone_jeremy',
        state: 'home',
        attributes: {
          x: 1,
          y: 2,
          confidence: 80,
          last_seen: '2026-01-11T00:00:00.000Z',
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    // Now unassign the tracker from the person.
    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        state: 'home',
        attributes: {
          friendly_name: 'Jeremy',
          device_trackers: [],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    // Even if the tracker continues to send updates, it should no longer be accepted.
    for (const h of handlers) {
      h({
        entity_id: 'device_tracker.phone_jeremy',
        state: 'home',
        attributes: {
          x: 3,
          y: 4,
          confidence: 80,
          last_seen: '2026-01-11T00:00:01.000Z',
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('upserts tracker labels from person device_trackers on state changes', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');
    vi.stubEnv('VITE_HA_BASE_URL', 'http://ha.example:8123');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy Smith',
          entity_picture: '/api/image_proxy/image/abc',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        name: 'Jeremy Smith',
        avatarUrl: 'http://ha.example:8123/api/image_proxy/image/abc',
        initials: 'JS',
      });
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

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
      // One subscription for tracking + one for person label syncing.
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('does not start when HA_CONNECTION is disabled and warns in dev', async () => {
    const restoreDev = forceDevMode();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'false');

    const subscribeToStateChanges = vi.fn(async () => ({
      unsubscribe: vi.fn(async () => undefined),
    }));

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(0);
      expect(warnSpy).toHaveBeenCalled();
    });

    warnSpy.mockRestore();
    restoreDev();
  });

  it('handles fetchStates failure for person allowlist without subscribing (dev warn)', async () => {
    const restoreDev = forceDevMode();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);

    const fetchStates = vi.fn(async () => {
      throw new Error('boom');
    });

    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      // Tracking service subscription still happens, person subscription does not.
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
    });

    // Ensure non-person updates are ignored by the person handler when present.
    for (const h of handlers) {
      h({ entity_id: 'sensor.not_a_person', attributes: {} });
    }

    warnSpy.mockRestore();
    restoreDev();
  });

  it('ignores invalid device_trackers entries and prunes when device_trackers is not an array', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceLocationStore.getState().clear();
    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);

    const fetchStates = vi.fn(async () => [
      {
        entity_id: 'person.jeremy',
        state: 'home',
        attributes: {
          friendly_name: 'Jeremy',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
        last_changed: '2026-01-11T00:00:00.000Z',
        last_updated: '2026-01-11T00:00:00.000Z',
        context: { id: 'test', parent_id: null, user_id: null },
      } satisfies HaEntityState,
    ]);

    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    // Assign with mixed junk entries; only the valid device_tracker.* should be allowed.
    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy',
          device_trackers: [
            123,
            'phone_jeremy',
            'tracker.phone_jeremy',
            'device_tracker.phone_jeremy',
          ],
        },
      });
    }

    // Valid tracker should be accepted.
    for (const h of handlers) {
      h({
        entity_id: 'device_tracker.phone_jeremy',
        state: 'home',
        attributes: { x: 1, y: 2, confidence: 80, last_seen: '2026-01-11T00:00:00.000Z' },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    // If device_trackers becomes non-array, it should be treated as empty and pruned.
    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy',
          device_trackers: 'not-an-array',
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('does not upsert labels when person friendly_name is empty/whitespace', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: '   ',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    unmount();
  });

  it('exposes loaded device tracker metadata on window in dev mode', async () => {
    const restoreDev = forceDevMode();

    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async () => ({ unsubscribe }));

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const metadataByEntityId = {
      'device_tracker.phone_jeremy': { name: 'Jeremy', alias: 'phone:jeremy' },
    };

    const fetchByEntityId = vi.fn(async () => metadataByEntityId);

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        return {} as any;
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(fetchByEntityId).toHaveBeenCalledTimes(1);
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({ name: 'Jeremy', alias: 'phone:jeremy' });
    });

    await vi.waitFor(() => {
      expect((window as any).__hassDashDebug?.deviceTrackerMetadata).toEqual(metadataByEntityId);
      expect(typeof (window as any).__hassDashDebug?.getDeviceTrackerMetadataStoreState).toBe(
        'function'
      );
    });

    unmount();

    await vi.waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });

    useServiceSpy.mockRestore();
    restoreDev();
  });

  it('derives baseUrl from wss websocket URL when baseUrl missing (avatar URL resolution)', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig = {
      getConfig: vi.fn(() => ({ baseUrl: undefined, webSocketUrl: '' })),
      getEffectiveWebSocketUrl: vi.fn(() => 'wss://ha.example:8123/api/websocket'),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as any;
        }

        return {} as any;
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy Smith',
          entity_picture: '/api/image_proxy/image/abc',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        avatarUrl: 'https://ha.example:8123/api/image_proxy/image/abc',
      });
    });

    unmount();
    useServiceSpy.mockRestore();
  });

  it('uses absolute entity_picture URLs as-is and computes single-name initials', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig = {
      getConfig: vi.fn(() => ({ baseUrl: 'http://ha.example:8123', webSocketUrl: '' })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };
    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as any;
        }

        return {} as any;
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy',
          entity_picture: 'https://cdn.example/avatar.png',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        initials: 'J',
        avatarUrl: 'https://cdn.example/avatar.png',
      });
    });

    unmount();
    useServiceSpy.mockRestore();
  });

  it('warns in dev mode if device tracker metadata load fails', async () => {
    const restoreDev = forceDevMode();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async () => ({ unsubscribe }));

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => {
      throw new Error('nope');
    });

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        return {} as any;
      });

    render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(fetchByEntityId).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
    });

    useServiceSpy.mockRestore();
    warnSpy.mockRestore();
    restoreDev();
  });

  it('derives baseUrl from ws websocket URL and resolves relative entity_picture', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig = {
      getConfig: vi.fn(() => ({
        baseUrl: undefined,
        webSocketUrl: 'ws://ha.example:8123/api/websocket',
      })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as any;
        }

        return {} as any;
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy',
          entity_picture: '/api/image_proxy/image/abc',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        avatarUrl: 'http://ha.example:8123/api/image_proxy/image/abc',
      });
    });

    unmount();
    useServiceSpy.mockRestore();
  });

  it('keeps relative entity_picture unchanged when websocket URL is not ws/wss', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: any) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h) => {
      handlers.push(h as any);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig = {
      getConfig: vi.fn(() => ({
        baseUrl: undefined,
        webSocketUrl: 'http://ha.example:8123/api/websocket',
      })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol) => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          return { fetchByEntityId } as any;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService as any;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as any;
        }

        return {} as any;
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await vi.waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    for (const h of handlers) {
      h({
        entity_id: 'person.jeremy',
        attributes: {
          friendly_name: 'Jeremy',
          entity_picture: '/api/image_proxy/image/abc',
          device_trackers: ['device_tracker.phone_jeremy'],
        },
      });
    }

    await vi.waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        avatarUrl: '/api/image_proxy/image/abc',
      });
    });

    unmount();
    useServiceSpy.mockRestore();
  });
});
