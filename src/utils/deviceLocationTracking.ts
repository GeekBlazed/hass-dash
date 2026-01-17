export const deriveBaseUrlFromWebSocketUrl = (webSocketUrl: string): string | undefined => {
  try {
    const url = new URL(webSocketUrl.trim());

    // Map ws/wss -> http/https.
    if (url.protocol === 'ws:') url.protocol = 'http:';
    else if (url.protocol === 'wss:') url.protocol = 'https:';
    else return undefined;

    url.pathname = '/';
    url.search = '';
    url.hash = '';

    return url.toString();
  } catch {
    return undefined;
  }
};

export const resolveEntityPictureUrl = (
  entityPicture: string,
  baseUrl: string | undefined
): string | undefined => {
  const raw = entityPicture.trim();
  if (!raw) return undefined;

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  if (raw.startsWith('/')) {
    if (!baseUrl) return raw;
    return new URL(raw, baseUrl).toString();
  }

  return raw;
};

export const computeInitials = (name: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const parts = trimmed
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';

  const firstChar = first[0] ?? '';
  const lastChar = last ? (last[0] ?? '') : '';
  const initials = `${firstChar}${lastChar}`.trim().toUpperCase();
  return initials || undefined;
};
