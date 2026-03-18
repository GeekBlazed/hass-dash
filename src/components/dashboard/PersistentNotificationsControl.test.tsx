import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '../../types/notifications';
import { PersistentNotificationsControl } from './PersistentNotificationsControl';

const flags: Record<string, boolean> = {
  NOTIFICATIONS: true,
  NOTIFICATIONS_PERSISTENT: true,
};

const state: {
  persistent: NotificationItem[];
  unreadPersistentIds: string[];
  markPersistentRead: ReturnType<typeof vi.fn>;
  markAllPersistentRead: ReturnType<typeof vi.fn>;
} = {
  persistent: [],
  unreadPersistentIds: [],
  markPersistentRead: vi.fn(),
  markAllPersistentRead: vi.fn(),
};

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => ({ isEnabled: Boolean(flags[flag]) }),
}));

vi.mock('../../stores/useNotificationStore', () => ({
  useNotificationStore: (selector: (s: unknown) => unknown) => selector(state),
}));

const makePersistent = (
  id: string,
  body: string,
  format: 'text' | 'markdown' | 'html' = 'text',
  overrides?: Partial<NotificationItem>
): NotificationItem => ({
  id,
  dedupeKey: id,
  surface: 'persistent',
  content: {
    title: `Persistent ${id}`,
    body,
    format,
  },
  source: 'test.source',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  duplicateCount: 1,
  read: false,
  expiresAt: null,
  ...overrides,
});

describe('PersistentNotificationsControl', () => {
  beforeEach(() => {
    flags.NOTIFICATIONS = true;
    flags.NOTIFICATIONS_PERSISTENT = true;
    state.persistent = [];
    state.unreadPersistentIds = [];
    state.markPersistentRead.mockReset();
    state.markAllPersistentRead.mockReset();
  });

  it('renders nothing when notifications or persistent flag is disabled', () => {
    flags.NOTIFICATIONS = false;
    const { container } = render(<PersistentNotificationsControl />);
    expect(container.firstChild).toBeNull();

    flags.NOTIFICATIONS = true;
    flags.NOTIFICATIONS_PERSISTENT = false;
    const { container: c2 } = render(<PersistentNotificationsControl />);
    expect(c2.firstChild).toBeNull();
  });

  it('opens panel, shows empty state, and marks all read on open', async () => {
    const user = userEvent.setup();
    render(<PersistentNotificationsControl />);

    const button = screen.getByRole('button', { name: /notifications/i });
    await user.click(button);

    expect(state.markAllPersistentRead).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No persistent notifications yet.')).toBeInTheDocument();

    // Closing should not trigger mark-all again.
    await user.click(button);
    expect(state.markAllPersistentRead).toHaveBeenCalledTimes(1);
  });

  it('renders unread badge, duplicate count, mark read action, and sanitized content', async () => {
    const user = userEvent.setup();

    state.persistent = [
      makePersistent('a', 'Line 1\nLine 2', 'text', { duplicateCount: 2 }),
      makePersistent('b', '**Bold** and `code`', 'markdown'),
      makePersistent('c', '<script>bad()</script><a href="javascript:alert(1)">Link</a>', 'html', {
        content: {
          title: 'Persistent c',
          body: '<script>bad()</script><a href="javascript:alert(1)">Link</a>',
          format: 'html',
          imageUrl: 'https://example.com/pic.jpg',
        },
      }),
    ];
    state.unreadPersistentIds = ['a'];

    const { container } = render(<PersistentNotificationsControl />);
    const button = screen.getByRole('button', { name: /notifications/i });
    await user.click(button);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark read' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(state.markPersistentRead).toHaveBeenCalledWith('a');

    expect(container.querySelector('script')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });
});
