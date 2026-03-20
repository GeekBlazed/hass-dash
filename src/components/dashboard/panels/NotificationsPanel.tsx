import { useEffect, useMemo } from 'react';

import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useNotificationStore } from '../../../stores/useNotificationStore';
import { renderNotificationContentHtml } from '../../../utils/notificationContentRenderer';

export interface NotificationsPanelProps {
  isHidden: boolean;
}

export function NotificationsPanel({ isHidden }: NotificationsPanelProps) {
  const { isEnabled: notificationsEnabled } = useFeatureFlag('NOTIFICATIONS');
  const { isEnabled: persistentEnabled } = useFeatureFlag('NOTIFICATIONS_PERSISTENT');

  const persistent = useNotificationStore((s) => s.persistent);
  const unreadPersistentIds = useNotificationStore((s) => s.unreadPersistentIds);
  const markPersistentRead = useNotificationStore((s) => s.markPersistentRead);
  const markAllPersistentRead = useNotificationStore((s) => s.markAllPersistentRead);
  const clearPersistent = useNotificationStore((s) => s.clearPersistent);

  useEffect(() => {
    if (isHidden || !notificationsEnabled || !persistentEnabled) return;
    markAllPersistentRead();
  }, [isHidden, markAllPersistentRead, notificationsEnabled, persistentEnabled]);

  const ordered = useMemo(() => persistent.slice(), [persistent]);
  const notificationCount = ordered.length;

  if (!notificationsEnabled || !persistentEnabled) {
    return (
      <section
        id="notifications-panel"
        className={`tile notifications-panel${isHidden ? 'is-hidden' : ''}`}
        aria-label="Notifications"
      >
        <div className="notifications-panel__empty">Notifications are unavailable.</div>
      </section>
    );
  }

  return (
    <section
      id="notifications-panel"
      className={`tile notifications-panel${isHidden ? 'is-hidden' : ''}`}
      aria-label="Notifications"
    >
      <header className="notifications-panel__head">
        <h2 className="notifications-panel__title" aria-live="polite" aria-atomic="true">
          {`Notifications: ${notificationCount}`}
        </h2>
        <button
          type="button"
          className="modal-popup__action-btn"
          onClick={clearPersistent}
          disabled={notificationCount === 0}
        >
          Dismiss all
        </button>
      </header>

      {ordered.length === 0 ? (
        <div className="notifications-panel__empty">No persistent notifications yet.</div>
      ) : (
        <div className="notifications-panel__list" aria-live="polite" aria-atomic="false">
          {ordered.map((item) => {
            const unread = unreadPersistentIds.includes(item.id);
            return (
              <article
                key={item.id}
                className="notification-toasts__item"
                aria-label={item.content.title || 'Persistent notification'}
              >
                <div className="notification-toasts__head">
                  <div className="notification-toasts__meta">
                    {item.content.title && (
                      <h3 className="notification-toasts__title">{item.content.title}</h3>
                    )}
                    <div className="notification-toasts__source">{item.source}</div>
                  </div>
                  <div className="notification-toasts__actions">
                    {item.duplicateCount > 1 && (
                      <span
                        className="notification-toasts__count"
                        aria-label={`${item.duplicateCount} duplicates`}
                        title={`${item.duplicateCount} duplicates`}
                      >
                        {item.duplicateCount}
                      </span>
                    )}
                    {unread && (
                      <button
                        type="button"
                        className="modal-popup__action-btn"
                        onClick={() => markPersistentRead(item.id)}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>

                {item.content.imageUrl && (
                  <img
                    src={item.content.imageUrl}
                    alt=""
                    className="notification-toasts__image"
                    loading="lazy"
                  />
                )}

                <div
                  className="notification-toasts__body"
                  dangerouslySetInnerHTML={{ __html: renderNotificationContentHtml(item.content) }}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
