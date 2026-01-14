import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TYPES } from '../../core/types';
import * as useServiceModule from '../../hooks/useService';
import type {
  DeviceTrackerMetadata,
  IDeviceTrackerMetadataService,
} from '../../interfaces/IDeviceTrackerMetadataService';
import type { IEntityService } from '../../interfaces/IEntityService';
import type { IHomeAssistantConnectionConfig } from '../../interfaces/IHomeAssistantConnectionConfig';
import { useDeviceLocationStore } from '../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../stores/useDeviceTrackerMetadataStore';
import type { HaEntityState } from '../../types/home-assistant';
import {
  computeInitials,
  deriveBaseUrlFromWebSocketUrl,
  DeviceLocationTrackingController,
  resolveEntityPictureUrl,
} from './DeviceLocationTrackingController';

declare global {
  interface Window {
    __hassDashDebug?: {
      deviceTrackerMetadata?: Record<string, DeviceTrackerMetadata>;
      getDeviceTrackerMetadataStoreState?: () => unknown;
    };
  }
}

describe('DeviceLocationTrackingController', () => {
  const makeHaEntityState = (overrides: {
    entity_id: string;
    state?: string;
    attributes?: Record<string, unknown>;
  }): HaEntityState => {
    return {
      entity_id: overrides.entity_id,
      state: overrides.state ?? 'home',
      attributes: overrides.attributes ?? {},
      last_changed: '2026-01-11T00:00:00.000Z',
      last_updated: '2026-01-11T00:00:00.000Z',
      context: { id: 'test', parent_id: null, user_id: null },
    };
  };

  const forceDevMode = (): (() => void) => {
    const env = import.meta.env as unknown as Record<string, unknown>;
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

    const handlers: Array<(nextState: HaEntityState) => void> = [];
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

    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    // Emit a tracker location update. It should only be accepted because it's assigned.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'device_tracker.phone_jeremy',
            state: 'home',
            attributes: {
              x: 1,
              y: 2,
              confidence: 80,
              last_seen: '2026-01-11T00:00:00.000Z',
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    // Now unassign the tracker from the person.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            state: 'home',
            attributes: {
              friendly_name: 'Jeremy',
              device_trackers: [],
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    // Even if the tracker continues to send updates, it should no longer be accepted.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'device_tracker.phone_jeremy',
            state: 'home',
            attributes: {
              x: 3,
              y: 4,
              confidence: 80,
              last_seen: '2026-01-11T00:00:01.000Z',
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('seeds initial locations from fetchStates snapshot for assigned trackers', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceLocationStore.getState().clear();
    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];
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
      {
        entity_id: 'device_tracker.phone_jeremy',
        state: 'home',
        attributes: {
          x: 1,
          y: 2,
          confidence: 80,
          last_seen: '2026-01-11T00:00:00.000Z',
        },
        last_changed: '2026-01-11T00:00:00.000Z',
        last_updated: '2026-01-11T00:00:00.000Z',
        context: { id: 'test', parent_id: null, user_id: null },
      } satisfies HaEntityState,
    ]);

    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    // Without any emitted state_changed updates, the snapshot should have seeded the store.
    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('accepts updates for alternate tracker entity ids when they share the same device_id as an assigned tracker', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceLocationStore.getState().clear();
    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => [
        {
          entity_id: 'person.jeremy',
          state: 'home',
          attributes: {
            friendly_name: 'Jeremy',
            // Assigned to one entity id...
            device_trackers: ['device_tracker.jeremy_phone'],
          },
          last_changed: '2026-01-11T00:00:00.000Z',
          last_updated: '2026-01-11T00:00:00.000Z',
          context: { id: 'test', parent_id: null, user_id: null },
        } satisfies HaEntityState,
      ]),
      subscribeToStateChanges: vi.fn(async (h: (newState: HaEntityState) => void) => {
        handlers.push(h);
        return { unsubscribe };
      }),
    };

    const fetchByEntityId = vi.fn(async () => ({
      // ...but metadata indicates both entity ids point at the same HA device registry entry.
      'device_tracker.jeremy_phone': { deviceId: 'dev-1', name: 'Jeremy Phone' },
      'device_tracker.phone_jeremy': { deviceId: 'dev-1', name: 'Jeremy Phone (alt)' },
    }));

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = { fetchByEntityId };
          return svc;
        }
        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          const cfg: Pick<
            IHomeAssistantConnectionConfig,
            'getConfig' | 'getEffectiveWebSocketUrl'
          > = {
            getConfig: vi.fn(() => ({ baseUrl: undefined, webSocketUrl: '' })),
            getEffectiveWebSocketUrl: vi.fn(() => ''),
          };
          return cfg;
        }
        if (typeId === TYPES.IEntityService) return entityService;
        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(fetchByEntityId).toHaveBeenCalledTimes(1);
      expect(entityService.fetchStates).toHaveBeenCalledTimes(1);
      expect(entityService.subscribeToStateChanges).toHaveBeenCalledTimes(2);
      expect(Object.keys(useDeviceTrackerMetadataStore.getState().metadataByEntityId)).toHaveLength(
        2
      );
    });

    // Emit a location update for the *other* entity id.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'device_tracker.phone_jeremy',
            state: 'home',
            attributes: {
              x: 10,
              y: 20,
              confidence: 80,
              last_seen: '2026-01-11T00:00:00.000Z',
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });

    useServiceSpy.mockRestore();
  });

  it('upserts tracker labels from person device_trackers on state changes', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');
    vi.stubEnv('VITE_HA_BASE_URL', 'http://ha.example:8123');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy Smith',
              entity_picture: '/api/image_proxy/image/abc',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        name: 'Jeremy Smith',
        avatarUrl: 'http://ha.example:8123/api/image_proxy/image/abc',
        initials: 'JS',
      });
    });

    unmount();

    await waitFor(() => {
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
    await waitFor(() => {
      // One subscription for tracking + one for person label syncing.
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    unmount();

    await waitFor(() => {
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

    await waitFor(() => {
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

    const handlers: Array<(nextState: HaEntityState) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);

    const fetchStates = vi.fn(async () => {
      throw new Error('boom');
    });

    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(fetchStates).toHaveBeenCalledTimes(1);
      // Tracking service subscription still happens, person subscription does not.
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalled();
    });

    // Ensure non-person updates are ignored by the person handler when present.
    for (const h of handlers) {
      h(makeHaEntityState({ entity_id: 'sensor.not_a_person', attributes: {} }));
    }

    warnSpy.mockRestore();
    restoreDev();
  });

  it('ignores invalid device_trackers entries and prunes when device_trackers is not an array', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceLocationStore.getState().clear();
    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];
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

    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates,
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    // Assign with mixed junk entries; only the valid device_tracker.* should be allowed.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
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
          })
        );
      }
    });

    // Valid tracker should be accepted.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'device_tracker.phone_jeremy',
            state: 'home',
            attributes: { x: 1, y: 2, confidence: 80, last_seen: '2026-01-11T00:00:00.000Z' },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeTruthy();
    });

    // If device_trackers becomes non-array, it should be treated as empty and pruned.
    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy',
              device_trackers: 'not-an-array',
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceLocationStore.getState().locationsByEntityId['device_tracker.phone_jeremy']
      ).toBeUndefined();
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  it('does not upsert labels when person friendly_name is empty/whitespace', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: '   ',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
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

    const metadataByEntityId: Record<string, DeviceTrackerMetadata> = {
      'device_tracker.phone_jeremy': { name: 'Jeremy', alias: 'phone:jeremy' },
    };

    const fetchByEntityId = vi.fn(async () => metadataByEntityId);

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(fetchByEntityId).toHaveBeenCalledTimes(1);
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({ name: 'Jeremy', alias: 'phone:jeremy' });
    });

    await waitFor(() => {
      expect(window.__hassDashDebug?.deviceTrackerMetadata).toEqual(metadataByEntityId);
      expect(typeof window.__hassDashDebug?.getDeviceTrackerMetadataStoreState).toBe('function');
    });

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(2);
    });

    useServiceSpy.mockRestore();
    restoreDev();
  });

  it('derives baseUrl from wss websocket URL when baseUrl missing (avatar URL resolution)', async () => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    vi.stubEnv('VITE_FEATURE_HA_CONNECTION', 'true');

    useDeviceTrackerMetadataStore.getState().clear();

    const handlers: Array<(nextState: HaEntityState) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig: Pick<
      IHomeAssistantConnectionConfig,
      'getConfig' | 'getEffectiveWebSocketUrl'
    > = {
      getConfig: vi.fn(() => ({ baseUrl: undefined, webSocketUrl: '' })),
      getEffectiveWebSocketUrl: vi.fn(() => 'wss://ha.example:8123/api/websocket'),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as unknown as IHomeAssistantConnectionConfig;
        }

        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy Smith',
              entity_picture: '/api/image_proxy/image/abc',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
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

    const handlers: Array<(nextState: HaEntityState) => void> = [];

    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig: Pick<
      IHomeAssistantConnectionConfig,
      'getConfig' | 'getEffectiveWebSocketUrl'
    > = {
      getConfig: vi.fn(() => ({ baseUrl: 'http://ha.example:8123', webSocketUrl: '' })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };
    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as unknown as IHomeAssistantConnectionConfig;
        }

        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy',
              entity_picture: 'https://cdn.example/avatar.png',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
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
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        return {};
      });

    render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
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

    const handlers: Array<(nextState: HaEntityState) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig: Pick<
      IHomeAssistantConnectionConfig,
      'getConfig' | 'getEffectiveWebSocketUrl'
    > = {
      getConfig: vi.fn(() => ({
        baseUrl: undefined,
        webSocketUrl: 'ws://ha.example:8123/api/websocket',
      })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as unknown as IHomeAssistantConnectionConfig;
        }

        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy',
              entity_picture: '/api/image_proxy/image/abc',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
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

    const handlers: Array<(nextState: HaEntityState) => void> = [];
    const unsubscribe = vi.fn(async () => undefined);
    const subscribeToStateChanges = vi.fn(async (h: (newState: HaEntityState) => void) => {
      handlers.push(h);
      return { unsubscribe };
    });

    const entityService: IEntityService = {
      fetchStates: vi.fn(async () => []),
      subscribeToStateChanges,
    };

    const fetchByEntityId = vi.fn(async () => ({}));
    const connectionConfig: Pick<
      IHomeAssistantConnectionConfig,
      'getConfig' | 'getEffectiveWebSocketUrl'
    > = {
      getConfig: vi.fn(() => ({
        baseUrl: undefined,
        webSocketUrl: 'http://ha.example:8123/api/websocket',
      })),
      getEffectiveWebSocketUrl: vi.fn(() => undefined),
    };

    const useServiceSpy = vi
      .spyOn(useServiceModule, 'useService')
      .mockImplementation((typeId: symbol): unknown => {
        if (typeId === TYPES.IDeviceTrackerMetadataService) {
          const svc: IDeviceTrackerMetadataService = {
            fetchByEntityId,
          };
          return svc;
        }

        if (typeId === TYPES.IEntityService) {
          return entityService;
        }

        if (typeId === TYPES.IHomeAssistantConnectionConfig) {
          return connectionConfig as unknown as IHomeAssistantConnectionConfig;
        }

        return {};
      });

    const { unmount } = render(<DeviceLocationTrackingController entityService={entityService} />);

    await waitFor(() => {
      expect(subscribeToStateChanges).toHaveBeenCalledTimes(2);
    });

    act(() => {
      for (const h of handlers) {
        h(
          makeHaEntityState({
            entity_id: 'person.jeremy',
            attributes: {
              friendly_name: 'Jeremy',
              entity_picture: '/api/image_proxy/image/abc',
              device_trackers: ['device_tracker.phone_jeremy'],
            },
          })
        );
      }
    });

    await waitFor(() => {
      expect(
        useDeviceTrackerMetadataStore.getState().metadataByEntityId['device_tracker.phone_jeremy']
      ).toMatchObject({
        avatarUrl: '/api/image_proxy/image/abc',
      });
    });

    unmount();
    useServiceSpy.mockRestore();
  });

  it('derives a base URL from a ws/wss URL', () => {
    expect(deriveBaseUrlFromWebSocketUrl('ws://example.local:8123/api/websocket')).toBe(
      'http://example.local:8123/'
    );
    expect(deriveBaseUrlFromWebSocketUrl('wss://example.local:8123/api/websocket')).toBe(
      'https://example.local:8123/'
    );
  });

  it('returns undefined base URL for invalid or non-websocket URLs', () => {
    expect(deriveBaseUrlFromWebSocketUrl('not a url')).toBeUndefined();
    expect(
      deriveBaseUrlFromWebSocketUrl('http://example.local:8123/api/websocket')
    ).toBeUndefined();
  });

  it('resolves entity_picture URLs (absolute, data/blob, and relative paths)', () => {
    expect(resolveEntityPictureUrl('  ', 'https://example.local:8123/')).toBeUndefined();

    expect(
      resolveEntityPictureUrl('https://cdn.example/avatar.png', 'https://example.local:8123/')
    ).toBe('https://cdn.example/avatar.png');
    expect(
      resolveEntityPictureUrl('data:image/png;base64,abc', 'https://example.local:8123/')
    ).toBe('data:image/png;base64,abc');
    expect(
      resolveEntityPictureUrl('blob:https://example.local/123', 'https://example.local:8123/')
    ).toBe('blob:https://example.local/123');

    expect(resolveEntityPictureUrl('/api/image/1', 'https://example.local:8123/')).toBe(
      'https://example.local:8123/api/image/1'
    );

    // If no baseUrl is available, keep the path for the browser to resolve.
    expect(resolveEntityPictureUrl('/api/image/1', undefined)).toBe('/api/image/1');

    // Non-leading-slash relative paths are returned as-is.
    expect(resolveEntityPictureUrl('local/path.png', 'https://example.local:8123/')).toBe(
      'local/path.png'
    );
  });

  it('computes initials from person names', () => {
    expect(computeInitials('')).toBeUndefined();
    expect(computeInitials('   ')).toBeUndefined();
    expect(computeInitials('Jeremy')).toBe('J');
    expect(computeInitials('Jeremy Smith')).toBe('JS');
    expect(computeInitials('  Mary   Jane   Watson  ')).toBe('MW');
  });
});
