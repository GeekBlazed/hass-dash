import { useEffect } from 'react';

import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { parseMaxVisibleToasts, useNotificationStore } from '../../stores/useNotificationStore';
import type { NotificationContent } from '../../types/notifications';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const markdownToHtml = (markdown: string): string => {
  // Intentionally minimal markdown support for bootstrap discovery.
  return escapeHtml(markdown)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
};

const sanitizeHtml = (rawHtml: string): string => {
  if (typeof DOMParser === 'undefined') {
    return escapeHtml(rawHtml);
  }

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  for (const el of Array.from(doc.querySelectorAll('script,style,iframe,object,embed,link,meta'))) {
    el.remove();
  }

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();

      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        continue;
      }

      if (name === 'href' || name === 'src') {
        const safe =
          value.startsWith('/') ||
          value.startsWith('http://') ||
          value.startsWith('https://') ||
          value.startsWith('data:image/');
        if (!safe) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  return doc.body.innerHTML;
};

const renderContentHtml = (content: NotificationContent): string => {
  if (content.format === 'html') {
    return sanitizeHtml(content.body);
  }

  if (content.format === 'markdown') {
    return sanitizeHtml(markdownToHtml(content.body));
  }

  return sanitizeHtml(escapeHtml(content.body).replace(/\n/g, '<br/>'));
};

export function NotificationToasts() {
  const { isEnabled: notificationsEnabled } = useFeatureFlag('NOTIFICATIONS');
  const { isEnabled: toastsEnabled } = useFeatureFlag('NOTIFICATIONS_TOASTS');

  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const pruneExpiredToasts = useNotificationStore((s) => s.pruneExpiredToasts);

  useEffect(() => {
    if (!notificationsEnabled || !toastsEnabled) return;

    // Prune immediately so first paint is already clean.
    pruneExpiredToasts();

    const timer = window.setInterval(() => {
      pruneExpiredToasts();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [notificationsEnabled, pruneExpiredToasts, toastsEnabled]);

  const maxVisibleToasts = parseMaxVisibleToasts();
  const activeToasts = toasts;
  const visible = activeToasts.slice(0, maxVisibleToasts);
  const activeToastCount = activeToasts.length;

  if (!notificationsEnabled || !toastsEnabled) return null;
  if (visible.length === 0) return null;

  return (
    <div
      className="modal-popup modal-popup--top-right notification-toasts"
      aria-label="Notifications"
    >
      <div className="modal-popup__head">
        <span className="modal-popup__label">Notifications</span>
        {activeToastCount > maxVisibleToasts && (
          <button type="button" className="modal-popup__action-btn" aria-label="Active toast count">
            {`${activeToastCount} Active`}
          </button>
        )}
      </div>
      <div className="notification-toasts__list" aria-live="polite" aria-atomic="false">
        {visible.map((item) => (
          <div
            key={item.id}
            role="alert"
            className="notification-toasts__item"
            aria-label={item.content.title || 'Notification toast'}
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
                <button
                  type="button"
                  className="modal-popup__action-btn"
                  onClick={() => dismissToast(item.id)}
                >
                  Dismiss
                </button>
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
              dangerouslySetInnerHTML={{ __html: renderContentHtml(item.content) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
