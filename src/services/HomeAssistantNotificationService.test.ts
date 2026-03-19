import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaStateChangedEventData } from '../types/home-assistant';
import { HomeAssistantNotificationService } from './HomeAssistantNotificationService';

describe('HomeAssistantNotificationService', () => {
  it('subscribes to persistent notification command stream and state_changed stream', async () => {
    const commandHandlerRef: { current?: (event: unknown) => void } = {};
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const commandSub = { unsubscribe: vi.fn().mockResolvedValue(undefined) };
    const stateSub = { unsubscribe: vi.fn().mockResolvedValue(undefined) };

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockImplementation(async (_command, handler) => {
        commandHandlerRef.current = handler;
        return commandSub;
      }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return stateSub;
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    const sub = await service.subscribe(handler);

    expect(haClient.subscribeToCommandStream).toHaveBeenCalledWith(
      { type: 'persistent_notification/subscribe' },
      expect.any(Function)
    );
    expect(haClient.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));

    await sub.unsubscribe();

    expect(commandSub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(stateSub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('maps persistent notification added/current updates to persistent records and removed updates to remove records', async () => {
    const commandHandlerRef: { current?: (event: unknown) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockImplementation(async (_command, handler) => {
        commandHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      subscribeToEvents: vi
        .fn()
        .mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    commandHandlerRef.current?.({
      type: 'current',
      notifications: {
        abc: {
          notification_id: 'abc',
          title: 'Door Open',
          message: 'Back door left open',
        },
      },
    });

    commandHandlerRef.current?.({
      type: 'removed',
      notifications: {
        abc: {
          notification_id: 'abc',
          title: 'Door Open',
          message: 'Back door left open',
        },
      },
    });

    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        surface: 'persistent',
        sourceKind: 'persistent_notification',
        dedupeKey: 'ha:persistent:abc',
      })
    );

    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        surface: 'persistent',
        sourceKind: 'persistent_notification',
        dedupeKey: 'ha:persistent:abc',
        remove: true,
      })
    );
  });

  it('maps alert state transitions to toast records', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.back_door',
        old_state: {
          entity_id: 'alert.back_door',
          state: 'off',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: '1', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.back_door',
          state: 'on',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '2', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'toast',
        sourceKind: 'alert_state',
        dedupeKey: 'ha:alert:alert.back_door:on',
        content: expect.objectContaining({ body: 'Back Door is now ON.' }),
      })
    );
  });

  it('maps event.* state changes to toast records with camera open action when camera entity is present', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.front_door_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.front_door_camera',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Front Door Camera',
            event_type: 'person_detected',
            camera_entity_id: 'camera.front_door',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '3', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: 'toast',
        sourceKind: 'event_entity',
        source: 'event.state_changed',
        ttlMs: 60_000,
        content: expect.objectContaining({ body: 'Event detected: person_detected' }),
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.front_door',
            focusPanel: 'cameras',
            sourceEntityId: 'event.front_door_camera',
          }),
        }),
      })
    );
  });

  it('maps allowed camera-detection events without camera entity id to focus-panel action', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.driveway_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.driveway_camera',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'vehicle_detected',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '4', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'focus-panel',
          payload: expect.objectContaining({
            panel: 'cameras',
            sourceEntityId: 'event.driveway_camera',
          }),
        }),
        ttlMs: 60_000,
      })
    );
  });

  it('ignores binary_sensor motion events for camera notifications', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'binary_sensor.bedroom_motion',
        old_state: {
          entity_id: 'binary_sensor.bedroom_motion',
          state: 'off',
          attributes: { device_class: 'motion' },
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: 'bm-1', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'binary_sensor.bedroom_motion',
          state: 'on',
          attributes: { device_class: 'motion' },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: 'bm-2', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('maps binary_sensor camera person transitions to toast records with camera action', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'binary_sensor.studio_camera_person',
        old_state: {
          entity_id: 'binary_sensor.studio_camera_person',
          state: 'off',
          attributes: {
            friendly_name: 'Studio Camera Person',
            device_class: 'occupancy',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '4a', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'binary_sensor.studio_camera_person',
          state: 'on',
          attributes: {
            friendly_name: 'Studio Camera Person',
            device_class: 'occupancy',
          },
          last_changed: '2026-01-01T00:02:00+00:00',
          last_updated: '2026-01-01T00:02:00+00:00',
          context: { id: '4b', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'binary_sensor.state_changed',
        sourceKind: 'event_entity',
        dedupeKey: 'ha:binary_sensor:binary_sensor.studio_camera_person:person_detected:on',
        ttlMs: 60_000,
        content: expect.objectContaining({ body: 'Event detected: person_detected' }),
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.studio',
            sourceEntityId: 'binary_sensor.studio_camera_person',
          }),
        }),
      })
    );
  });

  it('retries subscriptions once after retryable disconnect errors', async () => {
    let attempts = 0;

    const haClient = {
      isConnected: vi.fn().mockReturnValue(false),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockImplementation(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('Home Assistant client is not connected');
        }
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      subscribeToEvents: vi
        .fn()
        .mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    await service.subscribe(() => undefined);

    expect(haClient.connect).toHaveBeenCalled();
    expect(haClient.subscribeToCommandStream).toHaveBeenCalledTimes(2);
  });

  it('throws when command-stream subscription is unsupported', async () => {
    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToEvents: vi
        .fn()
        .mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);

    await expect(service.subscribe(() => undefined)).rejects.toThrow(
      'subscribeToCommandStream is not supported by this client'
    );
  });

  it('does not retry for non-retryable subscribe errors', async () => {
    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockRejectedValue(new Error('permission denied')),
      subscribeToEvents: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);

    await expect(service.subscribe(() => undefined)).rejects.toThrow('permission denied');
    expect(haClient.subscribeToCommandStream).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed persistent update frames and empty messages', async () => {
    const commandHandlerRef: { current?: (event: unknown) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockImplementation(async (_command, handler) => {
        commandHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      subscribeToEvents: vi
        .fn()
        .mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    commandHandlerRef.current?.({ type: 'unknown', notifications: {} });
    commandHandlerRef.current?.({ type: 'current', notifications: null });
    commandHandlerRef.current?.({
      type: 'added',
      notifications: {
        empty: {
          notification_id: 'empty',
          title: 'Ignored',
          message: '   ',
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('uses notification map key when notification_id is missing and maps updated events', async () => {
    const commandHandlerRef: { current?: (event: unknown) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockImplementation(async (_command, handler) => {
        commandHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      subscribeToEvents: vi
        .fn()
        .mockResolvedValue({ unsubscribe: vi.fn().mockResolvedValue(undefined) }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    commandHandlerRef.current?.({
      type: 'updated',
      notifications: {
        fallback_id: {
          title: 'Updated Title',
          message: 'Updated body',
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'ha:persistent:fallback_id',
        source: 'persistent_notification.updated',
      })
    );
  });

  it('ignores non-alert and non-event entities in state_changed stream', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'light.kitchen',
        old_state: null,
        new_state: {
          entity_id: 'light.kitchen',
          state: 'on',
          attributes: {},
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '5', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores state_changed frames without entity id', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: '',
        old_state: null,
        new_state: null,
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not emit alert toast for unchanged and unsupported alert transitions', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.window',
        old_state: {
          entity_id: 'alert.window',
          state: 'on',
          attributes: {},
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: '6', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.window',
          state: 'on',
          attributes: {},
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '7', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.window',
        old_state: {
          entity_id: 'alert.window',
          state: 'on',
          attributes: {},
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: '8', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.window',
          state: 'unknown_state',
          attributes: {},
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '9', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores event entities for non-allowlisted event types', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.mailbox_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.mailbox_camera',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Mailbox Camera',
            event_type: 'motion_detected',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '10', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores event entities when event_type and state are empty after trim', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.blank',
        old_state: null,
        new_state: {
          entity_id: 'event.blank',
          state: '   ',
          attributes: {
            friendly_name: 'Blank Event',
            event_type: '   ',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps upstream subscriptions alive until last handler unsubscribes', async () => {
    const commandSub = { unsubscribe: vi.fn().mockResolvedValue(undefined) };
    const stateSub = { unsubscribe: vi.fn().mockResolvedValue(undefined) };

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue(commandSub),
      subscribeToEvents: vi.fn().mockResolvedValue(stateSub),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const sub1 = await service.subscribe(() => undefined);
    const sub2 = await service.subscribe(() => undefined);

    await sub1.unsubscribe();
    expect(commandSub.unsubscribe).not.toHaveBeenCalled();
    expect(stateSub.unsubscribe).not.toHaveBeenCalled();

    await sub2.unsubscribe();
    expect(commandSub.unsubscribe).toHaveBeenCalledTimes(1);
    expect(stateSub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
