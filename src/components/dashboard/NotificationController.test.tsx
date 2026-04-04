import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationController } from './NotificationController';

const notificationService = {
  subscribe: vi.fn(),
};

const flags: Record<string, boolean> = {
  NOTIFICATIONS: true,
  NOTIFICATIONS_TOASTS: true,
  NOTIFICATIONS_PERSISTENT: true,
  NOTIFICATION_ACTIONS: true,
};

const entityState: {
  entitiesById: Record<string, { state: string; attributes?: Record<string, unknown> }>;
} = {
  entitiesById: {},
};

const notificationState = {
  addToast: vi.fn(),
  addPersistent: vi.fn(),
  removePersistentByDedupeKey: vi.fn(),
  seedMockPersistent: vi.fn(),
};

const dashboardState = {
  setActivePanel: vi.fn(),
  openCameraModal: vi.fn(),
};

const streamSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => ({ isEnabled: Boolean(flags[flag]) }),
}));

vi.mock('../../hooks/useService', () => ({
  useService: () => notificationService,
}));

vi.mock('../../stores/useEntityStore', () => ({
  useEntityStore: (selector: (s: unknown) => unknown) => selector(entityState),
}));

vi.mock('../../stores/useDashboardStore', () => ({
  useDashboardStore: (selector: (s: unknown) => unknown) => selector(dashboardState),
}));

vi.mock('../../stores/useNotificationStore', () => ({
  useNotificationStore: (selector: (s: unknown) => unknown) => selector(notificationState),
}));

describe('NotificationController', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    flags.NOTIFICATIONS = true;
    flags.NOTIFICATIONS_TOASTS = true;
    flags.NOTIFICATIONS_PERSISTENT = true;
    flags.NOTIFICATION_ACTIONS = true;
    entityState.entitiesById = {};
    notificationState.addToast.mockReset();
    notificationState.addPersistent.mockReset();
    notificationState.removePersistentByDedupeKey.mockReset();
    notificationState.seedMockPersistent.mockReset();
    dashboardState.setActivePanel.mockReset();
    dashboardState.openCameraModal.mockReset();
    streamSubscription.unsubscribe.mockReset();
    notificationService.subscribe.mockReset();
    notificationService.subscribe.mockResolvedValue(streamSubscription);
  });

  it('does nothing when notifications are disabled', () => {
    flags.NOTIFICATIONS = false;

    render(<NotificationController />);

    expect(notificationService.subscribe).not.toHaveBeenCalled();
    expect(notificationState.seedMockPersistent).not.toHaveBeenCalled();
    expect(notificationState.addPersistent).not.toHaveBeenCalled();
    expect(notificationState.addToast).not.toHaveBeenCalled();
  });

  it('seeds persistent notifications when mock mode is enabled', () => {
    vi.stubEnv('VITE_FEATURE_NOTIFICATIONS_MOCK', 'true');
    vi.stubEnv('DEV', 'true');

    render(<NotificationController />);

    expect(notificationState.seedMockPersistent).toHaveBeenCalledTimes(1);
    expect(notificationState.addPersistent).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'mock-system-ready' })
    );
  });

  it('does not seed persistent notifications when mock mode is disabled', () => {
    vi.stubEnv('VITE_FEATURE_NOTIFICATIONS_MOCK', 'false');

    render(<NotificationController />);

    expect(notificationState.seedMockPersistent).not.toHaveBeenCalled();
    expect(notificationState.addPersistent).not.toHaveBeenCalled();
  });

  it('does not seed bootstrap example toasts in mock mode', () => {
    vi.stubEnv('VITE_FEATURE_NOTIFICATIONS_MOCK', 'true');

    const { rerender } = render(<NotificationController />);
    rerender(<NotificationController />);

    expect(notificationState.addToast).not.toHaveBeenCalled();
  });

  it('emits toast on light state transition and ignores unsupported transitions', () => {
    vi.stubEnv('VITE_FEATURE_NOTIFICATIONS_MOCK', 'false');

    entityState.entitiesById = {
      'light.kitchen': {
        state: 'off',
        attributes: { friendly_name: 'Kitchen' },
      },
      'sensor.temp': {
        state: '10',
      },
    };

    const { rerender } = render(<NotificationController />);
    expect(notificationState.addToast).toHaveBeenCalledTimes(0);

    entityState.entitiesById = {
      ...entityState.entitiesById,
      'light.kitchen': {
        state: 'on',
        attributes: { friendly_name: 'Kitchen' },
      },
    };
    rerender(<NotificationController />);
    expect(notificationState.addToast).toHaveBeenCalledTimes(1);
    expect(notificationState.addToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ dedupeKey: 'light:light.kitchen:on' })
    );

    // No change should not emit.
    rerender(<NotificationController />);
    expect(notificationState.addToast).toHaveBeenCalledTimes(1);

    // Unsupported values should not emit.
    entityState.entitiesById = {
      ...entityState.entitiesById,
      'light.kitchen': {
        state: 'unavailable',
        attributes: {},
      },
    };
    rerender(<NotificationController />);
    expect(notificationState.addToast).toHaveBeenCalledTimes(1);

    // Transition back to off should emit and fall back to entity id when no display name exists.
    entityState.entitiesById = {
      ...entityState.entitiesById,
      'light.kitchen': {
        state: 'off',
        attributes: {},
      },
    };
    rerender(<NotificationController />);
    expect(notificationState.addToast).toHaveBeenCalledTimes(2);
    expect(notificationState.addToast).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dedupeKey: 'light:light.kitchen:off',
        content: expect.objectContaining({ body: 'light.kitchen is now OFF.' }),
      })
    );
  });

  it('routes live stream records to store actions and removes persistent records', async () => {
    render(<NotificationController />);

    const streamHandler = notificationService.subscribe.mock.calls[0]?.[0] as
      | ((record: {
          surface: 'toast' | 'persistent';
          dedupeKey: string;
          remove?: boolean;
          source: string;
          sourceKind: 'alert_state' | 'event_entity' | 'persistent_notification';
          content: { body: string };
        }) => void)
      | undefined;

    expect(streamHandler).toBeTypeOf('function');

    streamHandler?.({
      surface: 'toast',
      dedupeKey: 'ha:alert:alert.front_door:on',
      source: 'alert.state_changed',
      sourceKind: 'alert_state',
      content: { body: 'Front door alert' },
    });

    streamHandler?.({
      surface: 'persistent',
      dedupeKey: 'ha:persistent:abc',
      source: 'persistent_notification.added',
      sourceKind: 'persistent_notification',
      content: { body: 'Persistent body' },
    });

    streamHandler?.({
      surface: 'persistent',
      dedupeKey: 'ha:persistent:abc',
      source: 'persistent_notification.removed',
      sourceKind: 'persistent_notification',
      content: { body: '' },
      remove: true,
    });

    expect(notificationState.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'ha:alert:alert.front_door:on' })
    );
    expect(notificationState.addPersistent).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: 'ha:persistent:abc' })
    );
    expect(notificationState.removePersistentByDedupeKey).toHaveBeenCalledWith('ha:persistent:abc');
  });

  it('does not auto-switch panels when stream emits camera action records', () => {
    render(<NotificationController />);

    const streamHandler = notificationService.subscribe.mock.calls[0]?.[0] as
      | ((record: {
          surface: 'toast' | 'persistent';
          dedupeKey: string;
          source: string;
          sourceKind: 'alert_state' | 'event_entity' | 'persistent_notification';
          content: { body: string };
          action?: { type: 'open-camera' | 'focus-panel'; payload?: Record<string, unknown> };
        }) => void)
      | undefined;

    streamHandler?.({
      surface: 'toast',
      dedupeKey: 'ha:event:event.front_door:person_detected:now',
      source: 'event.state_changed',
      sourceKind: 'event_entity',
      content: { body: 'Event detected' },
      action: {
        type: 'focus-panel',
        payload: { panel: 'cameras' },
      },
    });

    streamHandler?.({
      surface: 'toast',
      dedupeKey: 'ha:event:event.front_door:person_detected:later',
      source: 'event.state_changed',
      sourceKind: 'event_entity',
      content: { body: 'Event detected' },
      action: {
        type: 'open-camera',
        payload: { cameraEntityId: 'camera.front_door' },
      },
    });

    expect(dashboardState.setActivePanel).not.toHaveBeenCalled();
    expect(dashboardState.openCameraModal).not.toHaveBeenCalled();
  });

  it('does not execute action records when action flag is disabled', () => {
    flags.NOTIFICATION_ACTIONS = false;
    render(<NotificationController />);

    const streamHandler = notificationService.subscribe.mock.calls[0]?.[0] as
      | ((record: {
          surface: 'toast' | 'persistent';
          dedupeKey: string;
          source: string;
          sourceKind: 'alert_state' | 'event_entity' | 'persistent_notification';
          content: { body: string };
          action?: { type: 'open-camera' | 'focus-panel'; payload?: Record<string, unknown> };
        }) => void)
      | undefined;

    streamHandler?.({
      surface: 'toast',
      dedupeKey: 'ha:event:event.front_door:person_detected:now',
      source: 'event.state_changed',
      sourceKind: 'event_entity',
      content: { body: 'Event detected' },
      action: {
        type: 'open-camera',
        payload: { cameraEntityId: 'camera.front_door' },
      },
    });

    expect(dashboardState.setActivePanel).not.toHaveBeenCalled();
    expect(dashboardState.openCameraModal).not.toHaveBeenCalled();
  });
});
