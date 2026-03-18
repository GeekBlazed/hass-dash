import { useMemo, useState } from 'react';

import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { NotificationContent } from '../../types/notifications';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const markdownToHtml = (markdown: string): string => {
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

export function PersistentNotificationsControl() {
  const [open, setOpen] = useState(false);

  const { isEnabled: notificationsEnabled } = useFeatureFlag('NOTIFICATIONS');
  const { isEnabled: persistentEnabled } = useFeatureFlag('NOTIFICATIONS_PERSISTENT');

  const persistent = useNotificationStore((s) => s.persistent);
  const unreadPersistentIds = useNotificationStore((s) => s.unreadPersistentIds);
  const markPersistentRead = useNotificationStore((s) => s.markPersistentRead);
  const markAllPersistentRead = useNotificationStore((s) => s.markAllPersistentRead);

  const unreadCount = unreadPersistentIds.length;

  const ordered = useMemo(() => persistent.slice(), [persistent]);

  if (!notificationsEnabled || !persistentEnabled) return null;

  return (
    <section className="mt-3" aria-label="Persistent notifications">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) {
              markAllPersistentRead();
            }
          }}
          aria-expanded={open}
          aria-controls="persistent-notifications-panel"
        >
          Notifications
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          id="persistent-notifications-panel"
          className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-300 bg-white/90 p-2"
        >
          {ordered.length === 0 && (
            <div className="rounded border border-dashed border-slate-300 p-3 text-xs text-slate-500">
              No persistent notifications yet.
            </div>
          )}

          {ordered.map((item) => {
            const unread = unreadPersistentIds.includes(item.id);
            return (
              <article
                key={item.id}
                className={`rounded-md border p-2 ${unread ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {item.content.title && (
                      <h3 className="truncate text-xs font-semibold text-slate-900">
                        {item.content.title}
                      </h3>
                    )}
                    <div className="text-[11px] text-slate-500">{item.source}</div>
                  </div>

                  <div className="flex items-center gap-1">
                    {item.duplicateCount > 1 && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                        {item.duplicateCount}
                      </span>
                    )}
                    {unread && (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
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
                    className="mb-1 h-24 w-full rounded object-cover"
                    loading="lazy"
                  />
                )}

                <div
                  className="prose prose-sm max-w-none text-xs text-slate-700"
                  dangerouslySetInnerHTML={{ __html: renderContentHtml(item.content) }}
                />
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
