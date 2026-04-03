import { useEffect, useMemo, useRef, useState } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ICameraService } from '../../../interfaces/ICameraService';
import type { IHomeAssistantConnectionConfig } from '../../../interfaces/IHomeAssistantConnectionConfig';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityId } from '../../../types/home-assistant';
import { deriveBaseUrlFromWebSocketUrl } from '../../../utils/deviceLocationTracking';
import {
  canPlayHlsNatively,
  classifyStreamUrl,
  deriveProxyStreamUrlFromEntityPicture,
  getDisplayName,
  getEntityPictureUrl,
} from './cameraStreamUtils';

type PictureInPictureModalProps = {
  entityId: HaEntityId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DragPosition = {
  x: number;
  y: number;
};

const STREAM_START_TIMEOUT_MS = 6000;
const FALLBACK_MARGIN_PX = 24;
const PIP_WIDTH_VIEWPORT_RATIO = 0.2;
const PIP_HEIGHT_VIEWPORT_RATIO = 0.2;
const PIP_MIN_WIDTH_PX = 280;
const PIP_MIN_HEIGHT_PX = 180;

function getPiPSize(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 320, height: 180 };
  }

  const width = Math.max(
    PIP_MIN_WIDTH_PX,
    Math.round(window.innerWidth * PIP_WIDTH_VIEWPORT_RATIO)
  );
  const height = Math.max(
    PIP_MIN_HEIGHT_PX,
    Math.round(window.innerHeight * PIP_HEIGHT_VIEWPORT_RATIO)
  );

  return { width, height };
}

function clampPosition(
  position: DragPosition,
  size: { width: number; height: number }
): DragPosition {
  if (typeof window === 'undefined') return position;

  const maxX = Math.max(FALLBACK_MARGIN_PX, window.innerWidth - size.width - FALLBACK_MARGIN_PX);
  const maxY = Math.max(FALLBACK_MARGIN_PX, window.innerHeight - size.height - FALLBACK_MARGIN_PX);

  return {
    x: Math.min(Math.max(FALLBACK_MARGIN_PX, position.x), maxX),
    y: Math.min(Math.max(FALLBACK_MARGIN_PX, position.y), maxY),
  };
}

function getDefaultPosition(size: { width: number; height: number }): DragPosition {
  if (typeof window === 'undefined') {
    return { x: FALLBACK_MARGIN_PX, y: FALLBACK_MARGIN_PX };
  }

  return {
    x: Math.max(FALLBACK_MARGIN_PX, window.innerWidth - size.width - FALLBACK_MARGIN_PX),
    y: Math.max(FALLBACK_MARGIN_PX, window.innerHeight - size.height - FALLBACK_MARGIN_PX),
  };
}

function isLikelyEmbeddedPageUrl(url: string): boolean {
  try {
    const parsed = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    );
    const path = parsed.pathname.toLowerCase();
    const hasKnownMediaExtension =
      path.endsWith('.m3u8') ||
      path.endsWith('.mjpg') ||
      path.endsWith('.mjpeg') ||
      path.endsWith('.mp4') ||
      path.endsWith('.webm');

    if (hasKnownMediaExtension) return false;
    if (path.includes('/hdmi/')) return true;
    return path.endsWith('/');
  } catch {
    return false;
  }
}

export function PictureInPictureModal({
  entityId,
  open,
  onOpenChange,
}: PictureInPictureModalProps) {
  const cameraService = useService<ICameraService>(TYPES.ICameraService);
  const connectionConfig = useService<IHomeAssistantConnectionConfig>(
    TYPES.IHomeAssistantConnectionConfig
  );
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const stageMediaStreamUrl = useDashboardStore((s) => s.stageMediaStreamUrl);
  const setStageMediaStreamUrl = useDashboardStore((s) => s.setStageMediaStreamUrl);

  const entity = entitiesById[entityId];
  const cameraName = useMemo(() => getDisplayName(entity), [entity]);

  const [pipSize, setPipSize] = useState<{ width: number; height: number }>(() => getPiPSize());

  const [position, setPosition] = useState<DragPosition>(() =>
    clampPosition(getDefaultPosition(getPiPSize()), getPiPSize())
  );
  const [baseStreamUrl, setBaseStreamUrl] = useState<string | null>(null);
  const [pipOverrideStreamUrl, setPipOverrideStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [streamStartTimedOut, setStreamStartTimedOut] = useState(false);

  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

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

  const effectivePipStreamUrl = pipOverrideStreamUrl ?? baseStreamUrl;

  const streamKind = useMemo(() => {
    if (!effectivePipStreamUrl) return null;
    return classifyStreamUrl(effectivePipStreamUrl);
  }, [effectivePipStreamUrl]);

  const showsEmbeddedPage = useMemo(() => {
    if (!effectivePipStreamUrl) return false;
    return isLikelyEmbeddedPageUrl(effectivePipStreamUrl);
  }, [effectivePipStreamUrl]);

  const canAttemptStream = useMemo(() => {
    if (!effectivePipStreamUrl) return false;
    if (showsEmbeddedPage) return true;
    if (streamKind === 'hls' && !canPlayHlsNatively()) return false;
    return true;
  }, [effectivePipStreamUrl, showsEmbeddedPage, streamKind]);

  const switchToFallbackBaseStream = (): boolean => {
    if (!entityPictureStreamUrl) return false;
    if (!baseStreamUrl) return false;
    if (baseStreamUrl === entityPictureStreamUrl) return false;

    setBaseStreamUrl(entityPictureStreamUrl);
    setStreamStarted(false);
    setStreamStartTimedOut(false);
    setError(null);
    setPipOverrideStreamUrl(null);
    return true;
  };

  useEffect(() => {
    if (!open) return;
    if (!effectivePipStreamUrl) return;
    if (!canAttemptStream) return;

    const timeoutId = window.setTimeout(() => {
      setStreamStartTimedOut(true);
    }, STREAM_START_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canAttemptStream, effectivePipStreamUrl, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load(): Promise<void> {
      setError(null);
      setBaseStreamUrl(null);
      setStreamStarted(false);
      setStreamStartTimedOut(false);

      if (cameraService.getStreamUrl) {
        try {
          const url = await cameraService.getStreamUrl(entityId);
          if (cancelled) return;
          if (url?.trim()) {
            const nextKind = classifyStreamUrl(url);
            const canPlay = !(nextKind === 'hls' && !canPlayHlsNatively());
            if (canPlay || !entityPictureStreamUrl) {
              setBaseStreamUrl(url);
            } else {
              setBaseStreamUrl(entityPictureStreamUrl);
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

      if (entityPictureStreamUrl) {
        setBaseStreamUrl(entityPictureStreamUrl);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [cameraService, entityId, entityPictureStreamUrl, open]);

  useEffect(() => {
    if (!open) return;

    const handleViewportChange = () => {
      const nextSize = getPiPSize();

      setPipSize((previousSize) => {
        if (previousSize.width === nextSize.width && previousSize.height === nextSize.height) {
          return previousSize;
        }
        return nextSize;
      });

      setPosition((previousPosition) => clampPosition(previousPosition, nextSize));
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragOffsetRef.current) return;
      const next = clampPosition(
        {
          x: event.clientX - dragOffsetRef.current.x,
          y: event.clientY - dragOffsetRef.current.y,
        },
        pipSize
      );
      setPosition(next);
    };

    const handlePointerUp = () => {
      dragOffsetRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [open, pipSize]);

  if (!open) return null;

  const handleSwapWithStage = () => {
    if (!effectivePipStreamUrl) return;

    if (!stageMediaStreamUrl) {
      setStageMediaStreamUrl(effectivePipStreamUrl);
      setPipOverrideStreamUrl(null);
      return;
    }

    const nextStageUrl = effectivePipStreamUrl;
    const nextPipUrl = stageMediaStreamUrl;

    setStageMediaStreamUrl(nextStageUrl);
    setPipOverrideStreamUrl(nextPipUrl === baseStreamUrl ? null : nextPipUrl);
  };

  return (
    <div
      className="pip-modal"
      role="dialog"
      aria-label={`Picture-in-picture camera stream for ${cameraName || entityId}`}
      style={{
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div
        className="pip-modal__header"
        onPointerDown={(event) => {
          dragOffsetRef.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
          };
        }}
      >
        <span className="pip-modal__title">{cameraName || entityId}</span>
        <div className="pip-modal__actions">
          <button
            type="button"
            className="pip-modal__action-btn"
            onClick={handleSwapWithStage}
            disabled={!effectivePipStreamUrl}
          >
            Swap Stage
          </button>
          <button
            type="button"
            className="pip-modal__close-btn"
            aria-label="Close picture in picture"
            onClick={() => onOpenChange(false)}
          >
            x
          </button>
        </div>
      </div>

      <div className="pip-modal__body">
        {!error && canAttemptStream && effectivePipStreamUrl && showsEmbeddedPage && (
          <iframe
            src={effectivePipStreamUrl}
            title={`Picture-in-picture feed for ${cameraName || entityId}`}
            className="pip-modal__frame"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}

        {!error &&
          canAttemptStream &&
          effectivePipStreamUrl &&
          !showsEmbeddedPage &&
          streamKind === 'mjpeg' && (
            <img
              src={effectivePipStreamUrl}
              alt={`Live stream from ${cameraName || entityId}`}
              className="pip-modal__media"
              onLoad={() => setStreamStarted(true)}
              onError={() => {
                if (switchToFallbackBaseStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream failed to start');
              }}
            />
          )}

        {!error &&
          canAttemptStream &&
          effectivePipStreamUrl &&
          !showsEmbeddedPage &&
          streamKind !== 'mjpeg' && (
            <video
              src={effectivePipStreamUrl}
              className="pip-modal__media"
              controls
              autoPlay
              playsInline
              muted
              onPlaying={() => setStreamStarted(true)}
              onCanPlay={() => setStreamStarted(true)}
              onStalled={() => {
                if (switchToFallbackBaseStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream stalled');
              }}
              onError={() => {
                if (switchToFallbackBaseStream()) {
                  return;
                }
                setStreamStartTimedOut(true);
                setError('Stream failed to start');
              }}
            />
          )}

        {!error && !!effectivePipStreamUrl && !canAttemptStream && (
          <div className="pip-modal__status">Stream URL is not playable by this browser.</div>
        )}

        {!error && !effectivePipStreamUrl && <div className="pip-modal__status">Loading...</div>}

        {!error && !!effectivePipStreamUrl && !streamStarted && streamStartTimedOut && (
          <div className="pip-modal__status">Stream is still connecting...</div>
        )}

        {error && <div className="pip-modal__status">{error}</div>}
      </div>
    </div>
  );
}
