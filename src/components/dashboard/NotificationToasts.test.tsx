import { fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDashboardStore } from '../../stores/useDashboardStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { NotificationItem } from '../../types/notifications';
import { NotificationToasts } from './NotificationToasts';

const entityState: {
  entitiesById: Record<string, { attributes?: Record<string, unknown> }>;
} = {
  entitiesById: {},
};

vi.mock('../../stores/useEntityStore', () => ({
  useEntityStore: (selector: (s: unknown) => unknown) => selector(entityState),
}));

const flagState = {
  NOTIFICATIONS: true,
  NOTIFICATIONS_TOASTS: true,
};

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: 'NOTIFICATIONS' | 'NOTIFICATIONS_TOASTS') => ({
    isEnabled: flagState[flag],
  }),
}));

const makeToast = (
  id: string,
  body: string,
  format: 'text' | 'markdown' | 'html' = 'text',
  overrides?: Partial<NotificationItem>
): NotificationItem => ({
  id,
  dedupeKey: id,
  surface: 'toast',
  content: {
    title: `Title ${id}`,
    body,
    format,
  },
  source: 'test.source',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  duplicateCount: 1,
  read: true,
  expiresAt: Date.now() + 60_000,
  ...overrides,
});

const resetNotificationStore = () => {
  useNotificationStore.persist.clearStorage();
  useNotificationStore.setState(useNotificationStore.getInitialState(), true);
};

const resetDashboardStoreCamera = () => {
  useDashboardStore.getState().setActivePanel('climate');
  useDashboardStore.getState().closeCameraModal();
};

describe('NotificationToasts', () => {
  beforeEach(() => {
    resetNotificationStore();
    entityState.entitiesById = {};
    resetDashboardStoreCamera();
    flagState.NOTIFICATIONS = true;
    flagState.NOTIFICATIONS_TOASTS = true;
    vi.useRealTimers();
    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE', '3');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when notifications are disabled', () => {
    flagState.NOTIFICATIONS = false;
    useNotificationStore.setState({
      toasts: [makeToast('a', 'Body A')],
    });

    const { container } = render(<NotificationToasts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when toasts feature is disabled', () => {
    flagState.NOTIFICATIONS_TOASTS = false;
    useNotificationStore.setState({
      toasts: [makeToast('a', 'Body A')],
    });

    const { container } = render(<NotificationToasts />);
    expect(container.firstChild).toBeNull();
  });

  it('renders text, markdown, and sanitized html content', () => {
    useNotificationStore.setState({
      toasts: [
        makeToast('text', 'Line 1\nLine 2', 'text'),
        makeToast('markdown', '**Bold** and `code`', 'markdown', {
          duplicateCount: 2,
        }),
        makeToast(
          'html',
          '<script>bad()</script><a href="javascript:alert(1)">Click</a><img src="https://example.com/pic.jpg" srcdoc="x"/>',
          'html'
        ),
      ],
    });

    const { container } = render(<NotificationToasts />);

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // The sanitizer removes script nodes and unsafe href/srcdoc attributes.
    expect(container.querySelector('script')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBeNull();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('srcdoc')).toBeNull();
  });

  it('shows overflow count when active toasts exceed configured visible max', () => {
    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE', '1');
    useNotificationStore.setState({
      toasts: [makeToast('a', 'Body A'), makeToast('b', 'Body B')],
    });

    render(<NotificationToasts />);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Active toast count' })).toHaveTextContent(
      '2 Active'
    );
  });

  it('calls dismiss action when dismiss is clicked', async () => {
    const user = userEvent.setup();
    const dismissToast = vi.fn();
    useNotificationStore.setState({
      toasts: [makeToast('dismiss-me', 'Body A')],
      dismissToast,
    });

    render(<NotificationToasts />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismissToast).toHaveBeenCalledWith('dismiss-me');
  });

  it('prunes immediately and on interval when enabled', () => {
    vi.useFakeTimers();
    const pruneExpiredToasts = vi.fn();
    useNotificationStore.setState({
      toasts: [makeToast('timer', 'Body')],
      pruneExpiredToasts,
    });

    render(<NotificationToasts />);
    expect(pruneExpiredToasts).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(pruneExpiredToasts).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('opens camera modal and dismisses toast when camera preview card is clicked', async () => {
    entityState.entitiesById = {
      'camera.studio_camera': {
        attributes: {
          friendly_name: 'Studio Camera',
          entity_picture: '/api/camera_proxy/camera.studio_camera?token=test',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: { cameraEntityId: 'camera.studio_camera' },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open camera feed for camera.studio_camera' })
    );

    expect(useDashboardStore.getState().activePanel).toBe('cameras');
    expect(useDashboardStore.getState().selectedCameraEntityId).toBe('camera.studio_camera');
    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('keeps open-camera CTA visible when camera entity is not in local cache', () => {
    entityState.entitiesById = {};

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-missing', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              cameraEntityId: 'camera.studio_camera',
              sourceEntityId: 'binary_sensor.studio_camera_person',
            },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    expect(
      screen.getByRole('button', { name: 'Open camera feed for camera.studio_camera' })
    ).toBeInTheDocument();
  });

  it('infers camera entity id from binary sensor source when direct id is absent', () => {
    entityState.entitiesById = {
      'camera.garage': {
        attributes: {
          friendly_name: 'Garage Camera',
          entity_picture: '/api/camera_proxy/camera.garage?token=test',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-binary-source', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              sourceEntityId: 'binary_sensor.garage_person',
            },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    expect(
      screen.getByRole('button', { name: 'Open camera feed for camera.garage' })
    ).toBeInTheDocument();
  });

  it('infers camera entity id from event source with _camera suffix fallback', () => {
    entityState.entitiesById = {
      'camera.front_door': {
        attributes: {
          friendly_name: 'Front Door',
          entity_picture: '/api/camera_proxy/camera.front_door?token=test',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-event-source', 'Event detected: package_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              sourceEntityId: 'event.front_door_camera',
            },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    expect(
      screen.getByRole('button', { name: 'Open camera feed for camera.front_door' })
    ).toBeInTheDocument();
  });

  it('uses heuristic camera resolution from source entity tokens when no direct candidate exists', () => {
    entityState.entitiesById = {
      'camera.studio_view': {
        attributes: {
          friendly_name: 'Studio View',
          entity_picture: '/api/camera_proxy/camera.studio_view?token=test',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-heuristic', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              sourceEntityId: 'binary_sensor.studio_alarm',
            },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    expect(
      screen.getByRole('button', { name: 'Open camera feed for camera.studio_view' })
    ).toBeInTheDocument();
  });

  it('uses absolute preview URLs from camera entity picture as-is', () => {
    entityState.entitiesById = {
      'camera.pool': {
        attributes: {
          friendly_name: 'Pool Camera',
          entity_picture: 'https://cdn.example.com/pool/live.jpg',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-absolute-preview', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              cameraEntityId: 'camera.pool',
            },
          },
        }),
      ],
    });

    const { container } = render(<NotificationToasts />);

    const previewImage = container.querySelector('.notification-toasts__camera-preview img');
    expect(previewImage).not.toBeNull();
    expect(previewImage?.getAttribute('src')).toBe('https://cdn.example.com/pool/live.jpg');
  });

  it('uses non-proxy relative preview URL as-is', () => {
    vi.stubEnv('VITE_HA_BASE_URL', undefined);
    vi.stubEnv('VITE_HA_WEBSOCKET_URL', undefined);

    entityState.entitiesById = {
      'camera.deck': {
        attributes: {
          friendly_name: 'Deck Camera',
          entity_picture: '/images/deck/latest.jpg',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-relative-preview', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              cameraEntityId: 'camera.deck',
            },
          },
        }),
      ],
    });

    const { container } = render(<NotificationToasts />);

    const previewImage = container.querySelector('.notification-toasts__camera-preview img');
    expect(previewImage).not.toBeNull();
    expect(previewImage?.getAttribute('src')).toBe('/images/deck/latest.jpg');
  });

  it('resolves proxy preview URL to configured HA base URL', () => {
    vi.stubEnv('VITE_HA_BASE_URL', 'http://ha-local.geekblaze.com');

    entityState.entitiesById = {
      'camera.driveway_sd': {
        attributes: {
          friendly_name: 'Driveway Camera',
          entity_picture: '/api/camera_proxy/camera.driveway_sd?token=test',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-base-url', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              cameraEntityId: 'camera.driveway_sd',
            },
          },
        }),
      ],
    });

    const { container } = render(<NotificationToasts />);

    const previewImage = container.querySelector('.notification-toasts__camera-preview img');
    expect(previewImage).not.toBeNull();
    expect(previewImage?.getAttribute('src')).toBe(
      'http://ha-local.geekblaze.com/api/camera_proxy_stream/camera.driveway_sd?token=test'
    );
  });

  it('does not render camera preview CTA when action payload cannot resolve a camera entity', () => {
    entityState.entitiesById = {
      'camera.studio': {
        attributes: {
          friendly_name: 'Studio',
        },
      },
    };

    useNotificationStore.setState({
      toasts: [
        makeToast('camera-toast-unresolvable', 'Event detected: person_detected', 'text', {
          action: {
            type: 'open-camera',
            payload: {
              cameraEntityId: 'sensor.not_a_camera',
            },
          },
        }),
      ],
    });

    render(<NotificationToasts />);

    expect(screen.queryByLabelText(/Open camera feed for/i)).toBeNull();
  });
});
