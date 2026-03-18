import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationStore } from '../../stores/useNotificationStore';
import type { NotificationItem } from '../../types/notifications';
import { NotificationToasts } from './NotificationToasts';

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
  useNotificationStore.setState({
    toasts: [],
    persistent: [],
    unreadPersistentIds: [],
  });
};

describe('NotificationToasts', () => {
  beforeEach(() => {
    resetNotificationStore();
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
  });
});
