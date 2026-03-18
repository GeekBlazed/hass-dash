import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationController } from './NotificationController';

const flags: Record<string, boolean> = {
  NOTIFICATIONS: true,
  NOTIFICATIONS_TOASTS: true,
  NOTIFICATIONS_PERSISTENT: true,
};

const entityState: {
  entitiesById: Record<string, { state: string; attributes?: Record<string, unknown> }>;
} = {
  entitiesById: {},
};

const notificationState = {
  addToast: vi.fn(),
  addPersistent: vi.fn(),
  seedMockPersistent: vi.fn(),
};

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => ({ isEnabled: Boolean(flags[flag]) }),
}));

vi.mock('../../stores/useEntityStore', () => ({
  useEntityStore: (selector: (s: unknown) => unknown) => selector(entityState),
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
    entityState.entitiesById = {};
    notificationState.addToast.mockReset();
    notificationState.addPersistent.mockReset();
    notificationState.seedMockPersistent.mockReset();
  });

  it('does nothing when notifications are disabled', () => {
    flags.NOTIFICATIONS = false;

    render(<NotificationController />);

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

  it('seeds bootstrap toasts only once', () => {
    vi.stubEnv('VITE_FEATURE_NOTIFICATIONS_MOCK', 'true');

    const { rerender } = render(<NotificationController />);
    rerender(<NotificationController />);

    expect(notificationState.addToast).toHaveBeenCalledTimes(2);
    expect(notificationState.addToast).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ dedupeKey: 'mock-bootstrap-toast-ready' })
    );
    expect(notificationState.addToast).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dedupeKey: 'mock-bootstrap-toast-rich' })
    );
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
});
