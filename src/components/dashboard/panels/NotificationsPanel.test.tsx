import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationItem } from '../../../types/notifications';
import { NotificationsPanel } from './NotificationsPanel';

const flags: Record<string, boolean> = {
  NOTIFICATIONS: true,
  NOTIFICATIONS_PERSISTENT: true,
};

const state: {
  persistent: NotificationItem[];
  unreadPersistentIds: string[];
  markPersistentRead: ReturnType<typeof vi.fn>;
  markAllPersistentRead: ReturnType<typeof vi.fn>;
  clearPersistent: ReturnType<typeof vi.fn>;
} = {
  persistent: [],
  unreadPersistentIds: [],
  markPersistentRead: vi.fn(),
  markAllPersistentRead: vi.fn(),
  clearPersistent: vi.fn(),
};

vi.mock('../../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => ({ isEnabled: Boolean(flags[flag]) }),
}));

vi.mock('../../../stores/useNotificationStore', () => ({
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

describe('NotificationsPanel', () => {
  beforeEach(() => {
    flags.NOTIFICATIONS = true;
    flags.NOTIFICATIONS_PERSISTENT = true;
    state.persistent = [];
    state.unreadPersistentIds = [];
    state.markPersistentRead.mockReset();
    state.markAllPersistentRead.mockReset();
    state.clearPersistent.mockReset();
  });

  it('renders unavailable state when notifications are disabled', () => {
    flags.NOTIFICATIONS = false;

    render(<NotificationsPanel isHidden={false} />);

    expect(screen.queryByText('Notifications are unavailable.')).not.toBeNull();
    expect(state.markAllPersistentRead).not.toHaveBeenCalled();
  });

  it('renders empty state and marks all read when opened', () => {
    render(<NotificationsPanel isHidden={false} />);

    expect(screen.queryByText('Notifications: 0')).not.toBeNull();
    expect(screen.queryByText('No persistent notifications yet.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss all' }).hasAttribute('disabled')).toBe(true);
    expect(state.markAllPersistentRead).toHaveBeenCalledTimes(1);
  });

  it('does not mark all read while hidden', () => {
    render(<NotificationsPanel isHidden={true} />);

    expect(state.markAllPersistentRead).not.toHaveBeenCalled();
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

    const { container } = render(<NotificationsPanel isHidden={false} />);

    expect(screen.queryByText('Notifications: 3')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss all' }).hasAttribute('disabled')).toBe(
      false
    );
    expect(screen.queryByText(/Line 1/)).not.toBeNull();
    expect(screen.queryByText('Bold')).not.toBeNull();
    expect(screen.queryByText('code')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeNull();
    expect(screen.queryByLabelText('2 duplicates')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Mark read' }));
    expect(state.markPersistentRead).toHaveBeenCalledWith('a');

    expect(container.querySelector('script')).toBeNull();
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('strips risky attributes not covered by the old sanitizer', () => {
    state.persistent = [
      makePersistent(
        'xss-attrs',
        [
          '<a xlink:href="javascript:alert(1)">xlink</a>',
          '<img srcset="https://evil.com/track.png 2x" src="https://ok.com/img.png" alt="test"/>',
          '<form><button formaction="https://evil.com">go</button></form>',
          '<svg><script>evil()</script></svg>',
        ].join(''),
        'html'
      ),
    ];

    const { container } = render(<NotificationsPanel isHidden={false} />);

    // xlink:href must be stripped (not in allowlist)
    const xlinkEl = container.querySelector('[xlink\\:href]');
    expect(xlinkEl).toBeNull();

    // srcset must be stripped (not in allowlist)
    const imgWithSrcset = container.querySelector('img[srcset]');
    expect(imgWithSrcset).toBeNull();

    // formaction and form elements must be stripped
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('[formaction]')).toBeNull();

    // inline SVG must be stripped entirely
    expect(container.querySelector('svg')).toBeNull();
  });

  it('strips relative and non-https href/src values', () => {
    state.persistent = [
      makePersistent(
        'url-schemes',
        [
          '<a href="/internal/path">relative</a>',
          '<a href="javascript:alert(1)">js</a>',
          '<img src="data:text/html,<script>evil()</script>" alt="bad data"/>',
          '<a href="https://safe.example.com">safe</a>',
        ].join(''),
        'html'
      ),
    ];

    const { container } = render(<NotificationsPanel isHidden={false} />);

    // Relative hrefs must be stripped
    const relativeLink = container.querySelector('a[href="/internal/path"]');
    expect(relativeLink).toBeNull();

    // javascript: hrefs must be stripped
    const jsLink = container.querySelector('a[href^="javascript"]');
    expect(jsLink).toBeNull();

    // Non-image data URIs must be stripped
    const badDataImg = container.querySelector('img[src^="data:text"]');
    expect(badDataImg).toBeNull();

    // https:// hrefs must be preserved
    const safeLink = container.querySelector('a[href="https://safe.example.com"]');
    expect(safeLink).not.toBeNull();
  });

  it('clears all persistent notifications when dismiss all is clicked', async () => {
    const user = userEvent.setup();

    state.persistent = [makePersistent('a', 'Body')];

    render(<NotificationsPanel isHidden={false} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss all' }));
    expect(state.clearPersistent).toHaveBeenCalledTimes(1);
  });
});
