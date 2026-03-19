import type { NotificationContent } from '../types/notifications';

export const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const markdownToHtml = (markdown: string): string => {
  // Intentionally minimal markdown support for bootstrap discovery.
  return escapeHtml(markdown)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
};

export const sanitizeHtml = (rawHtml: string): string => {
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

export const renderNotificationContentHtml = (content: NotificationContent): string => {
  if (content.format === 'html') {
    return sanitizeHtml(content.body);
  }

  if (content.format === 'markdown') {
    return sanitizeHtml(markdownToHtml(content.body));
  }

  return sanitizeHtml(escapeHtml(content.body).replace(/\n/g, '<br/>'));
};
