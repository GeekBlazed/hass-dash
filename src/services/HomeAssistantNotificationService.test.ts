import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaStateChangedEventData } from '../types/home-assistant';
import { HomeAssistantNotificationService } from './HomeAssistantNotificationService';

describe('HomeAssistantNotificationService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

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

  it('emits remove records even when the service has no prior fingerprint for the dedupe key', async () => {
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
      type: 'removed',
      notifications: {
        orphaned: {
          notification_id: 'orphaned',
          title: 'Orphaned',
          message: 'Already gone',
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'ha:persistent:orphaned',
        source: 'persistent_notification.removed',
        remove: true,
      })
    );
  });

  it('suppresses replayed persistent current snapshots with unchanged content', async () => {
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
      type: 'current',
      notifications: {
        abc: {
          notification_id: 'abc',
          title: 'Door Open',
          message: 'Back door left open',
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits persistent updates when content changes for the same dedupe key', async () => {
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
      type: 'updated',
      notifications: {
        abc: {
          notification_id: 'abc',
          title: 'Door Open',
          message: 'Back door closed',
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dedupeKey: 'ha:persistent:abc',
        content: expect.objectContaining({ body: 'Back door closed' }),
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

  it('suppresses burst duplicate toast records with the same fingerprint', async () => {
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

    const event = {
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
    };

    stateHandlerRef.current?.(event);
    stateHandlerRef.current?.(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not suppress burst duplicates when window is disabled via env', async () => {
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');

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

    const event = {
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
    };

    stateHandlerRef.current?.(event);
    stateHandlerRef.current?.(event);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('suppresses only duplicates inside configured burst dedupe window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '50');

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

    const event = {
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
    };

    stateHandlerRef.current?.(event);
    stateHandlerRef.current?.(event);
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60);
    stateHandlerRef.current?.(event);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('suppresses toast spam by source key within configured cooldown window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '100');

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
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: '2', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.back_door',
        old_state: {
          entity_id: 'alert.back_door',
          state: 'on',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: '2', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.back_door',
          state: 'off',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: '3', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dedupeKey: 'ha:alert:alert.back_door:on' })
    );
  });

  it('emits again after source cooldown window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '100');

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
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: '2', parent_id: null, user_id: null },
        },
      },
    });

    vi.advanceTimersByTime(150);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.back_door',
        old_state: {
          entity_id: 'alert.back_door',
          state: 'on',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: '2', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.back_door',
          state: 'off',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: '3', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dedupeKey: 'ha:alert:alert.back_door:on' })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dedupeKey: 'ha:alert:alert.back_door:off' })
    );
  });

  it('applies alert-specific cooldown override without throttling event stream when event cooldown is disabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_ALERT_MS', '200');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_EVENT_MS', '0');

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
          context: { id: 'a1', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.back_door',
          state: 'on',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'a2', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'alert.back_door',
        old_state: {
          entity_id: 'alert.back_door',
          state: 'on',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'a2', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'alert.back_door',
          state: 'off',
          attributes: { friendly_name: 'Back Door' },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: 'a3', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.driveway_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.driveway_camera',
          state: '2026-01-01T00:00:01+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'vehicle_detected',
          },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'e1', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.driveway_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.driveway_camera',
          state: '2026-01-01T00:00:02+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'vehicle_detected',
          },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: 'e2', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dedupeKey: 'ha:alert:alert.back_door:on' })
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        dedupeKey: 'ha:event:event.driveway_camera:vehicle_detected:2026-01-01T00:00:01+00:00',
      })
    );
    expect(handler).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        dedupeKey: 'ha:event:event.driveway_camera:vehicle_detected:2026-01-01T00:00:02+00:00',
      })
    );
  });

  it('applies event-specific cooldown override for event stream suppression', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_EVENT_MS', '200');

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
          state: '2026-01-01T00:00:01+00:00',
          attributes: {
            friendly_name: 'Front Door Camera',
            event_type: 'person_detected',
            camera_entity_id: 'camera.front_door',
          },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'e10', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.front_door_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.front_door_camera',
          state: '2026-01-01T00:00:02+00:00',
          attributes: {
            friendly_name: 'Front Door Camera',
            event_type: 'person_detected',
            camera_entity_id: 'camera.front_door',
          },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: 'e11', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'ha:event:event.front_door_camera:person_detected:2026-01-01T00:00:01+00:00',
      })
    );
  });

  it('suppresses warning severity toasts using severity cooldown when source cooldown is disabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_WARNING_MS', '150');

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

    const warningEvent = {
      data: {
        entity_id: 'binary_sensor.garage_camera_person',
        old_state: {
          entity_id: 'binary_sensor.garage_camera_person',
          state: 'off',
          attributes: { friendly_name: 'Garage Camera Person', device_class: 'occupancy' },
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: 'sw1', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'binary_sensor.garage_camera_person',
          state: 'on',
          attributes: { friendly_name: 'Garage Camera Person', device_class: 'occupancy' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'sw2', parent_id: null, user_id: null },
        },
      },
    };

    stateHandlerRef.current?.(warningEvent);
    stateHandlerRef.current?.(warningEvent);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ source: 'binary_sensor.state_changed' })
    );
  });

  it('does not suppress info severity toasts when only warning severity cooldown is configured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_WARNING_MS', '150');

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
          state: '2026-01-01T00:00:01+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'vehicle_detected',
          },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'si1', parent_id: null, user_id: null },
        },
      },
    });

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.driveway_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.driveway_camera',
          state: '2026-01-01T00:00:02+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'vehicle_detected',
          },
          last_changed: '2026-01-01T00:00:02+00:00',
          last_updated: '2026-01-01T00:00:02+00:00',
          context: { id: 'si2', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('uses the larger cooldown between source and severity windows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    vi.stubEnv('VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS', '0');
    vi.stubEnv('VITE_NOTIFICATIONS_SOURCE_COOLDOWN_EVENT_MS', '50');
    vi.stubEnv('VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_WARNING_MS', '200');

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

    const warningEvent = {
      data: {
        entity_id: 'binary_sensor.window_camera_person',
        old_state: {
          entity_id: 'binary_sensor.window_camera_person',
          state: 'off',
          attributes: { friendly_name: 'Window Camera Person', device_class: 'occupancy' },
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: 'mx1', parent_id: null, user_id: null },
        },
        new_state: {
          entity_id: 'binary_sensor.window_camera_person',
          state: 'on',
          attributes: { friendly_name: 'Window Camera Person', device_class: 'occupancy' },
          last_changed: '2026-01-01T00:00:01+00:00',
          last_updated: '2026-01-01T00:00:01+00:00',
          context: { id: 'mx2', parent_id: null, user_id: null },
        },
      },
    };

    stateHandlerRef.current?.(warningEvent);

    vi.advanceTimersByTime(100);

    stateHandlerRef.current?.(warningEvent);

    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(120);

    stateHandlerRef.current?.(warningEvent);

    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    stateHandlerRef.current?.(warningEvent);

    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(210);

    stateHandlerRef.current?.(warningEvent);

    expect(handler).toHaveBeenCalledTimes(2);
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

  it('maps allowed camera-detection events without explicit camera attr to inferred open-camera action', async () => {
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
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.driveway',
            sourceEntityId: 'event.driveway_camera',
          }),
        }),
        ttlMs: 60_000,
      })
    );
  });

  it('prefers area-matching camera from candidate list for event actions', async () => {
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
        entity_id: 'event.front_entry',
        old_state: null,
        new_state: {
          entity_id: 'event.front_entry',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Front Entry Event',
            event_type: 'person_detected',
            area_id: 'front_entry',
            camera_entity_ids: ['camera.driveway', 'camera.front_entry'],
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11a', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.front_entry',
            sourceEntityId: 'event.front_entry',
          }),
        }),
      })
    );
  });

  it('infers camera target from source_entity_id when direct camera attr is missing', async () => {
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
        entity_id: 'event.person_detector',
        old_state: null,
        new_state: {
          entity_id: 'event.person_detector',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Person Detector Event',
            event_type: 'person_detected',
            source_entity_id: 'binary_sensor.garage_camera_person',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11b', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.garage',
            sourceEntityId: 'event.person_detector',
          }),
        }),
      })
    );
  });

  it('prefers registry area-matching camera candidate when token scoring is ambiguous', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      getEntityRegistry: vi.fn().mockResolvedValue([
        { entity_id: 'binary_sensor.detector_entry', area_id: 'area_driveway', labels: [] },
        { entity_id: 'camera.alpha', area_id: 'area_front', labels: [] },
        { entity_id: 'camera.beta', area_id: 'area_driveway', labels: [] },
      ]),
      getDeviceRegistry: vi.fn().mockResolvedValue([]),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.detector_feed',
        old_state: null,
        new_state: {
          entity_id: 'event.detector_feed',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Detector Feed',
            event_type: 'person_detected',
            source_entity_id: 'binary_sensor.detector_entry',
            camera_entity_ids: ['camera.alpha', 'camera.beta'],
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11c', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.beta',
            sourceEntityId: 'event.detector_feed',
          }),
        }),
      })
    );
  });

  it('prefers registry label overlap when camera candidates do not share an area', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      getEntityRegistry: vi.fn().mockResolvedValue([
        {
          entity_id: 'binary_sensor.detector_label_source',
          area_id: null,
          labels: ['label_perimeter'],
        },
        { entity_id: 'camera.alpha', area_id: null, labels: [] },
        { entity_id: 'camera.beta', area_id: null, labels: ['label_perimeter'] },
      ]),
      getDeviceRegistry: vi.fn().mockResolvedValue([]),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.tag_detector_feed',
        old_state: null,
        new_state: {
          entity_id: 'event.tag_detector_feed',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Tag Detector Feed',
            event_type: 'person_detected',
            source_entity_id: 'binary_sensor.detector_label_source',
            camera_entity_ids: ['camera.alpha', 'camera.beta'],
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11d', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.beta',
            sourceEntityId: 'event.tag_detector_feed',
          }),
        }),
      })
    );
  });

  it('uses device-registry inherited area and labels for camera candidate priority', async () => {
    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      getEntityRegistry: vi.fn().mockResolvedValue([
        {
          entity_id: 'binary_sensor.detector_device_source',
          device_id: 'device_source',
          area_id: null,
          labels: [],
        },
        { entity_id: 'camera.alpha', device_id: 'device_camera_a', area_id: null, labels: [] },
        { entity_id: 'camera.beta', device_id: 'device_camera_b', area_id: null, labels: [] },
      ]),
      getDeviceRegistry: vi.fn().mockResolvedValue([
        { id: 'device_source', area_id: 'area_driveway', labels: ['label_perimeter'] },
        { id: 'device_camera_a', area_id: 'area_front', labels: [] },
        { id: 'device_camera_b', area_id: 'area_driveway', labels: ['label_perimeter'] },
      ]),
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.device_registry_detector',
        old_state: null,
        new_state: {
          entity_id: 'event.device_registry_detector',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Device Registry Detector',
            event_type: 'person_detected',
            source_entity_id: ['binary_sensor.detector_device_source'],
            camera_entity_ids: ['camera.alpha', 'camera.beta'],
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: '11e', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'open-camera',
          payload: expect.objectContaining({
            cameraEntityId: 'camera.beta',
            sourceEntityId: 'event.device_registry_detector',
          }),
        }),
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

  it('ignores allowlisted event entities that do not have camera context or camera-hinted ids', async () => {
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
        entity_id: 'event.front_patio',
        old_state: null,
        new_state: {
          entity_id: 'event.front_patio',
          state: '2026-01-01T00:01:00+00:00',
          attributes: {
            friendly_name: 'Front Patio Event',
            event_type: 'person_detected',
          },
          last_changed: '2026-01-01T00:01:00+00:00',
          last_updated: '2026-01-01T00:01:00+00:00',
          context: { id: 'ev-no-camera', parent_id: null, user_id: null },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('refreshes stale registry snapshot in background while handling events', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const stateHandlerRef: { current?: (event: { data: HaStateChangedEventData }) => void } = {};

    const getEntityRegistry = vi
      .fn()
      .mockResolvedValue([{ entity_id: 'camera.driveway', area_id: 'area_a', labels: [] }]);
    const getDeviceRegistry = vi.fn().mockResolvedValue([]);

    const haClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      subscribeToCommandStream: vi.fn().mockResolvedValue({ unsubscribe: vi.fn() }),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        stateHandlerRef.current = handler;
        return { unsubscribe: vi.fn().mockResolvedValue(undefined) };
      }),
      getEntityRegistry,
      getDeviceRegistry,
    } as unknown as IHomeAssistantClient;

    const service = new HomeAssistantNotificationService(haClient);
    const handler = vi.fn();

    await service.subscribe(handler);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    stateHandlerRef.current?.({
      data: {
        entity_id: 'event.driveway_camera',
        old_state: null,
        new_state: {
          entity_id: 'event.driveway_camera',
          state: '2026-01-01T00:06:00+00:00',
          attributes: {
            friendly_name: 'Driveway Camera',
            event_type: 'person_detected',
            camera_entity_ids: ['camera.driveway'],
          },
          last_changed: '2026-01-01T00:06:00+00:00',
          last_updated: '2026-01-01T00:06:00+00:00',
          context: { id: 'refresh-1', parent_id: null, user_id: null },
        },
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(getEntityRegistry).toHaveBeenCalledTimes(2);
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
