import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IHttpClient } from '../interfaces/IHttpClient';
import { HomeAssistantDeviceTrackerMetadataService } from './HomeAssistantDeviceTrackerMetadataService';

const createConnectionConfig = (
  overrides?: Partial<ReturnType<IHomeAssistantConnectionConfig['getConfig']>>
): IHomeAssistantConnectionConfig => {
  const cfg = {
    baseUrl: 'http://ha.local:8123',
    webSocketUrl: 'ws://ha.local:8123/api/websocket',
    accessToken: 'token',
    ...(overrides ?? {}),
  };

  return {
    getConfig: () => cfg,
    getEffectiveWebSocketUrl: () => cfg.webSocketUrl,
    getAccessToken: () => cfg.accessToken,
    validate: () => ({ isValid: true, errors: [], effectiveWebSocketUrl: cfg.webSocketUrl }),
    getOverrides: () => ({}),
    setOverrides: () => undefined,
    clearOverrides: () => undefined,
  };
};

describe('HomeAssistantDeviceTrackerMetadataService', () => {
  it('joins entity_registry and device_registry into entityId->metadata map', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(async () => []),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' },
        { entity_id: 'light.kitchen', device_id: 'dev-2' },
        { entity_id: 'device_tracker.no_device', device_id: null },
      ]),
      getDeviceRegistry: vi.fn(async () => [
        { id: 'dev-1', name: 'Jeremy Phone', name_by_user: 'Jeremy' },
        { id: 'dev-2', name: 'Kitchen Light', name_by_user: null },
      ]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );
    const result = await service.fetchByEntityId();

    expect(result).toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: 'Jeremy Phone',
        avatarUrl: undefined,
        initials: 'J',
      },
    });
  });

  it('falls back to entity_registry name/original_name when device_id is missing', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(async () => []),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        {
          entity_id: 'device_tracker.tracker_rufus',
          device_id: null,
          name: 'Rufus',
          original_name: 'tracker_rufus',
        },
      ]),
      getDeviceRegistry: vi.fn(async () => []),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );
    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.tracker_rufus': {
        deviceId: undefined,
        alias: 'tracker_rufus',
        name: 'Rufus',
        avatarUrl: undefined,
        initials: 'R',
      },
    });
  });

  it('returns empty map when endpoints return non-arrays', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(async () => []),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => ({}) as unknown[]),
      getDeviceRegistry: vi.fn(async () => ({}) as unknown[]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );
    await expect(service.fetchByEntityId()).resolves.toEqual({});
  });

  it('prefers person friendly name for device_tracker labels when person.device_trackers is assigned', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(
        async () =>
          [
            {
              entity_id: 'person.jeremy',
              state: 'home',
              attributes: {
                friendly_name: 'Jeremy',
                entity_picture: '/api/image_proxy/image/abc',
                device_trackers: ['device_tracker.phone_jeremy'],
              },
            },
            {
              entity_id: 'device_tracker.phone_jeremy',
              state: 'home',
              attributes: {
                friendly_name: 'Jeremy Phone',
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' },
      ]),
      getDeviceRegistry: vi.fn(async () => [
        { id: 'dev-1', name: 'Jeremy Phone', name_by_user: null },
      ]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig({ baseUrl: 'http://ha.example:8123' })
    );
    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: undefined,
        avatarUrl: 'http://ha.example:8123/api/image_proxy/image/abc',
        initials: 'J',
      },
    });
  });

  it('derives baseUrl from wss:// websocket URL when baseUrl is missing (avatarUrl)', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(
        async () =>
          [
            {
              entity_id: 'person.jeremy',
              state: 'home',
              attributes: {
                friendly_name: 'Jeremy',
                entity_picture: '/api/image_proxy/image/abc',
                device_trackers: ['device_tracker.phone_jeremy'],
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' },
      ]),
      getDeviceRegistry: vi.fn(async () => [
        { id: 'dev-1', name: 'Jeremy Phone', name_by_user: null },
      ]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig({
        baseUrl: undefined,
        webSocketUrl: 'wss://ha.example:8123/api/websocket',
      })
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: undefined,
        avatarUrl: 'https://ha.example:8123/api/image_proxy/image/abc',
        initials: 'J',
      },
    });
  });

  it('keeps relative avatarUrl when baseUrl cannot be determined', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(
        async () =>
          [
            {
              entity_id: 'person.jeremy',
              state: 'home',
              attributes: {
                friendly_name: 'Jeremy',
                entity_picture: '/api/image_proxy/image/abc',
                device_trackers: ['device_tracker.phone_jeremy'],
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' },
      ]),
      getDeviceRegistry: vi.fn(async () => [
        { id: 'dev-1', name: 'Jeremy Phone', name_by_user: null },
      ]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig({ baseUrl: undefined, webSocketUrl: 'not-a-url' })
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: undefined,
        avatarUrl: '/api/image_proxy/image/abc',
        initials: 'J',
      },
    });
  });

  it('uses REST registry endpoints when WS registry is not available', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(async () => []),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      // No WS registry methods provided.
    } as unknown as IHomeAssistantClient;

    const httpClient: IHttpClient = {
      get: vi.fn(async (url: string) => {
        if (url === '/api/config/entity_registry/list') {
          return [{ entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' }] as unknown;
        }

        if (url === '/api/config/device_registry/list') {
          return [{ id: 'dev-1', name: 'Jeremy Phone', name_by_user: 'Jeremy' }] as unknown;
        }

        return [] as unknown;
      }) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy',
        alias: 'Jeremy Phone',
        avatarUrl: undefined,
        initials: 'J',
      },
    });
  });

  it('returns empty map when neither WS nor REST registries are available', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(async () => []),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      // No registry APIs.
    } as unknown as IHomeAssistantClient;

    const httpClient = {} as unknown as IHttpClient;

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({});
  });

  it('derives baseUrl from ws:// effective websocket URL when baseUrl and config websocketUrl are missing', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => false),
      getStates: vi.fn(
        async () =>
          [
            {
              entity_id: 'person.jeremy',
              state: 'home',
              attributes: {
                friendly_name: 'Jeremy Smith',
                entity_picture: '/api/image_proxy/image/abc',
                device_trackers: ['device_tracker.phone_jeremy'],
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.phone_jeremy', device_id: 'dev-1' },
      ]),
      getDeviceRegistry: vi.fn(async () => [{ id: 'dev-1', name: null, name_by_user: null }]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const connectionConfig: IHomeAssistantConnectionConfig = {
      getConfig: () => ({ baseUrl: undefined, webSocketUrl: undefined, accessToken: 'token' }),
      getEffectiveWebSocketUrl: () => 'ws://ha.example:8123/api/websocket',
      getAccessToken: () => 'token',
      validate: () => ({
        isValid: true,
        errors: [],
        effectiveWebSocketUrl: 'ws://ha.example:8123/api/websocket',
      }),
      getOverrides: () => ({}),
      setOverrides: () => undefined,
      clearOverrides: () => undefined,
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      connectionConfig
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.phone_jeremy': {
        deviceId: 'dev-1',
        name: 'Jeremy Smith',
        alias: undefined,
        avatarUrl: 'http://ha.example:8123/api/image_proxy/image/abc',
        initials: 'JS',
      },
    });
  });

  it('skips invalid person payloads and ignores invalid device_trackers entries', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(
        async () =>
          [
            // Not a usable person (friendly_name not a string).
            {
              entity_id: 'person.bad',
              state: 'home',
              attributes: {
                friendly_name: 123,
                device_trackers: ['device_tracker.ignored'],
              },
            },
            // Not a usable person (device_trackers not an array).
            {
              entity_id: 'person.bad2',
              state: 'home',
              attributes: {
                friendly_name: 'Jamie',
                device_trackers: 'device_tracker.nope',
              },
            },
            // Valid person entry but device_trackers includes junk.
            {
              entity_id: 'person.jamie',
              state: 'home',
              attributes: {
                friendly_name: 'Jamie',
                entity_picture: 123,
                device_trackers: [123, 'sensor.nope', 'device_tracker.good'],
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        { entity_id: 'device_tracker.good', device_id: 'dev-1' },
      ]),
      getDeviceRegistry: vi.fn(async () => [{ id: 'dev-1', name: 'Tracker', name_by_user: null }]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.good': {
        deviceId: 'dev-1',
        name: 'Jamie',
        alias: undefined,
        avatarUrl: undefined,
        initials: 'J',
      },
    });
  });

  it('handles registry parsing edge cases (non-object rows, device_id fallback, empty display name)', async () => {
    const haClient: IHomeAssistantClient = {
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getStates: vi.fn(
        async () =>
          [
            {
              entity_id: 'device_tracker.two',
              state: 'home',
              attributes: {
                friendly_name: 'Tracker Two',
              },
            },
          ] as never
      ),
      getState: vi.fn(async () => null),
      getServices: vi.fn(async () => []),
      subscribeToEvents: vi.fn(async () => ({ unsubscribe: async () => undefined })),
      callService: vi.fn(async () => ({}) as never),
      getEntityRegistry: vi.fn(async () => [
        // Invalid rows should be ignored.
        123,
        {},
        { entity_id: 'device_tracker.two', device_id: 'dev-2', name: null, original_name: 'two' },
      ]),
      getDeviceRegistry: vi.fn(async () => [
        // Invalid row should be ignored.
        'not-an-object',
        // Use device_id fallback, name_by_user set but name missing.
        { device_id: 'dev-1', name: null, name_by_user: 'User One' },
        // Device with no name (forces undefined displayName).
        { id: 'dev-2', name: null, name_by_user: null },
      ]),
    };

    const httpClient: IHttpClient = {
      get: vi.fn(async () => undefined) as unknown as IHttpClient['get'],
      post: vi.fn(async () => undefined) as unknown as IHttpClient['post'],
    };

    const service = new HomeAssistantDeviceTrackerMetadataService(
      haClient,
      httpClient,
      createConnectionConfig()
    );

    await expect(service.fetchByEntityId()).resolves.toEqual({
      'device_tracker.two': {
        deviceId: 'dev-2',
        // Falls back to runtime friendly_name when device registry provides no name.
        name: 'Tracker Two',
        alias: undefined,
        avatarUrl: undefined,
        initials: 'TT',
      },
    });
  });
});
