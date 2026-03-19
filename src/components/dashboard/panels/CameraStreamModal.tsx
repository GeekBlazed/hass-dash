import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { deriveBaseUrlFromWebSocketUrl } from '../../../utils/deviceLocationTracking';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ICameraService } from '../../../interfaces/ICameraService';
import type { IHomeAssistantConnectionConfig } from '../../../interfaces/IHomeAssistantConnectionConfig';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityId, HaEntityState } from '../../../types/home-assistant';
import { Dialog, DialogClose, DialogContent } from '../../ui/Dialog';

type CameraStreamModalProps = {
  entityId: HaEntityId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STREAM_START_TIMEOUT_MS = 6000;
const CAMERA_TITLE_FONT_SIZE_EM = 2;
const CAMERA_TITLE_MARGIN_LEFT_PX = 20;
const CAMERA_TITLE_MARGIN_TOP_PX = 10;
const CAMERA_TITLE_SHADOW_X_PX = 4;
const CAMERA_TITLE_SHADOW_Y_PX = 4;
const CAMERA_TITLE_SHADOW_BLUR_PX = 10;
const CAMERA_TITLE_TEXT_COLOR = 'black';

const CAMERA_TITLE_STYLE: CSSProperties = {
  fontSize: `${CAMERA_TITLE_FONT_SIZE_EM}em`,
  marginLeft: CAMERA_TITLE_MARGIN_LEFT_PX,
  marginTop: CAMERA_TITLE_MARGIN_TOP_PX,
  textShadow: `${CAMERA_TITLE_SHADOW_X_PX}px ${CAMERA_TITLE_SHADOW_Y_PX}px ${CAMERA_TITLE_SHADOW_BLUR_PX}px ${CAMERA_TITLE_TEXT_COLOR}`,
};

function getDisplayName(entity: HaEntityState | undefined): string {
  if (!entity) return '';
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
}

function classifyStreamUrl(url: string): 'hls' | 'mjpeg' | 'unknown' {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('application/vnd.apple.mpegurl')) return 'hls';
  // Home Assistant's MJPEG proxy stream endpoint.
  if (lower.includes('/api/camera_proxy_stream/')) return 'mjpeg';
  if (lower.includes('mjpeg') || lower.includes('.mjpg') || lower.includes('.mjpeg'))
    return 'mjpeg';
  return 'unknown';
}

function getEntityPictureUrl(
  entity: HaEntityState | undefined,
  haBaseUrl: string | undefined
): string | null {
  const attrs = entity?.attributes as Record<string, unknown> | undefined;
  const raw = typeof attrs?.entity_picture === 'string' ? attrs.entity_picture.trim() : '';
  if (!raw) return null;

  // If the entity gives us an absolute URL (or data/blob), keep it.
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  // If it's a path (common: `/api/camera_proxy/...?...token=...`), prefer an
  // absolute HA URL so media loads directly (no CORS for <img>/<video> and no
  // Vite proxy involvement).
  if (raw.startsWith('/')) {
    if (!haBaseUrl) return raw;
    try {
      return new URL(raw, haBaseUrl).toString();
    } catch {
      return raw;
    }
  }

  // Best-effort for odd relative values.
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return null;
  }
}

function deriveProxyStreamUrlFromEntityPicture(entityPictureUrl: string): string | null {
  // If the camera entity_picture points at `/api/camera_proxy/<entity>?token=...`
  // then the MJPEG stream is typically available at `/api/camera_proxy_stream/<entity>?token=...`.
  try {
    const url = new URL(entityPictureUrl);
    if (!url.pathname.startsWith('/api/camera_proxy/')) return null;
    url.pathname = url.pathname.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    return url.toString();
  } catch {
    // If it's a path-only value, do a simple transform.
    if (entityPictureUrl.startsWith('/api/camera_proxy/')) {
      return entityPictureUrl.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    }
    return null;
  }
}

function canPlayHlsNatively(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  const result = video.canPlayType('application/vnd.apple.mpegurl');
  return result === 'probably' || result === 'maybe';
}

export function CameraStreamModal({ entityId, open, onOpenChange }: CameraStreamModalProps) {
  const cameraService = useService<ICameraService>(TYPES.ICameraService);
  const connectionConfig = useService<IHomeAssistantConnectionConfig>(
    TYPES.IHomeAssistantConnectionConfig
  );
  const entitiesById = useEntityStore((s) => s.entitiesById);

  const entity = entitiesById[entityId];
  const cameraName = useMemo(() => getDisplayName(entity), [entity]);

  const haBaseUrl = useMemo(() => {
    const cfg = connectionConfig.getConfig();
    const base = cfg.baseUrl?.trim();
    if (base) return base;

    const ws = connectionConfig.getEffectiveWebSocketUrl();
    return ws ? deriveBaseUrlFromWebSocketUrl(ws) : undefined;
  }, [connectionConfig]);

  const entityPictureUrl = useMemo(
    () => getEntityPictureUrl(entity, haBaseUrl),
    [entity, haBaseUrl]
  );

  const entityPictureStreamUrl = useMemo(() => {
    if (!entityPictureUrl) return null;
    return deriveProxyStreamUrlFromEntityPicture(entityPictureUrl);
  }, [entityPictureUrl]);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [streamStartTimedOut, setStreamStartTimedOut] = useState(false);

  const streamKind = useMemo(() => {
    if (!streamUrl) return null;
    return classifyStreamUrl(streamUrl);
  }, [streamUrl]);

  const canAttemptStream = useMemo(() => {
    if (!streamUrl) return false;
    if (streamKind === 'hls' && !canPlayHlsNatively()) return false;
    return true;
  }, [streamKind, streamUrl]);

  const switchToFallbackStream = (): boolean => {
    if (!entityPictureStreamUrl) return false;
    if (!streamUrl) return false;
    if (streamUrl === entityPictureStreamUrl) return false;

    setStreamUrl(entityPictureStreamUrl);
    setStreamStarted(false);
    setStreamStartTimedOut(false);
    setError(null);
    return true;
  };

  useEffect(() => {
    if (!open) return;

    if (!streamUrl) return;
    if (!canAttemptStream) return;

    const timeoutId = window.setTimeout(() => {
      setStreamStartTimedOut(true);
    }, STREAM_START_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canAttemptStream, open, streamUrl]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load(): Promise<void> {
      setError(null);
      setStreamUrl(null);
      setStreamStarted(false);
      setStreamStartTimedOut(false);

      // Prefer camera service stream URL to allow integrations to select best
      // quality (for example HD vs SD). Fall back to entity_picture proxy stream.
      if (cameraService.getStreamUrl) {
        try {
          const url = await cameraService.getStreamUrl(entityId);
          if (cancelled) return;
          if (url?.trim()) {
            const nextKind = classifyStreamUrl(url);
            const canPlay = !(nextKind === 'hls' && !canPlayHlsNatively());
            if (canPlay || !entityPictureStreamUrl) {
              setStreamUrl(url);
            } else {
              setStreamUrl(entityPictureStreamUrl);
            }
            return;
          }
        } catch (e: unknown) {
          if (cancelled) return;
          if (!entityPictureStreamUrl) {
            setError(e instanceof Error ? e.message : 'Failed to load camera stream');
            return;
          }
        }
      }

      // Prefer the MJPEG proxy stream used by the official Home Assistant dashboard.
      // Avoid pre-probing: multipart streams can be slow to deliver the first frame,
      // and probing can mis-detect them as "not multipart".
      if (entityPictureStreamUrl) {
        setStreamUrl(entityPictureStreamUrl);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [cameraService, entityId, entityPictureStreamUrl, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        insetPx={40}
        overlayClassName="bg-black/80"
        className="border-0 bg-transparent p-0 shadow-none"
        showCloseButton={false}
      >
        <div className="relative h-full w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <div
            className="pointer-events-none absolute top-0 left-0 z-20 rounded-md bg-black/50 px-2 py-1 leading-none font-medium text-white"
            style={CAMERA_TITLE_STYLE}
          >
            {cameraName || entityId}
          </div>

          <DialogClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="absolute top-3 right-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-md bg-black/50 text-white opacity-90 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-white/70 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </DialogClose>

          {!error && canAttemptStream && streamUrl && streamKind === 'mjpeg' && (
            <img
              src={streamUrl}
              alt={`Live stream from ${cameraName || entityId}`}
              className="absolute inset-0 h-full w-full object-cover"
              onLoad={() => setStreamStarted(true)}
              onError={() => {
                if (switchToFallbackStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream failed to start');
              }}
            />
          )}

          {!error && canAttemptStream && streamUrl && streamKind !== 'mjpeg' && (
            <video
              src={streamUrl}
              className="absolute inset-0 h-full w-full object-cover"
              controls
              autoPlay
              playsInline
              muted
              onPlaying={() => setStreamStarted(true)}
              onCanPlay={() => setStreamStarted(true)}
              onStalled={() => {
                if (switchToFallbackStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream stalled');
              }}
              onError={() => {
                if (switchToFallbackStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream failed to start');
              }}
            />
          )}

          {!error && !!streamUrl && !canAttemptStream && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-white/80">
              Stream URL is not playable by this browser.
            </div>
          )}

          {!error && !streamUrl && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-white/80">
              Loading…
            </div>
          )}
          {!error && !!streamUrl && !streamStarted && streamStartTimedOut && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-white/80">
              Stream is still connecting…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-sm text-white/80">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
