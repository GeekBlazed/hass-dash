import type { HaEntityState } from '../../../types/home-assistant';

export function getDisplayName(entity: HaEntityState | undefined): string {
  if (!entity) return '';
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
}

export function classifyStreamUrl(url: string): 'hls' | 'mjpeg' | 'unknown' {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('application/vnd.apple.mpegurl')) return 'hls';
  if (lower.includes('/api/camera_proxy_stream/')) return 'mjpeg';
  if (lower.includes('mjpeg') || lower.includes('.mjpg') || lower.includes('.mjpeg')) {
    return 'mjpeg';
  }
  return 'unknown';
}

export function getEntityPictureUrl(
  entity: HaEntityState | undefined,
  haBaseUrl: string | undefined
): string | null {
  const attrs = entity?.attributes as Record<string, unknown> | undefined;
  const raw = typeof attrs?.entity_picture === 'string' ? attrs.entity_picture.trim() : '';
  if (!raw) return null;

  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  if (raw.startsWith('/')) {
    if (!haBaseUrl) return raw;
    try {
      return new URL(raw, haBaseUrl).toString();
    } catch {
      return raw;
    }
  }

  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return null;
  }
}

export function deriveProxyStreamUrlFromEntityPicture(entityPictureUrl: string): string | null {
  try {
    const url = new URL(entityPictureUrl);
    if (!url.pathname.startsWith('/api/camera_proxy/')) return null;
    url.pathname = url.pathname.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    return url.toString();
  } catch {
    if (entityPictureUrl.startsWith('/api/camera_proxy/')) {
      return entityPictureUrl.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    }
    return null;
  }
}

export function canPlayHlsNatively(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  const result = video.canPlayType('application/vnd.apple.mpegurl');
  return result === 'probably' || result === 'maybe';
}
