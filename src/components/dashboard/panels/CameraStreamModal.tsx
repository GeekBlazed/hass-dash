import { useEffect, useMemo, useRef, useState } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ICameraService } from '../../../interfaces/ICameraService';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityId, HaEntityState } from '../../../types/home-assistant';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog';

type CameraStreamModalProps = {
  entityId: HaEntityId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  if (lower.includes('mjpeg') || lower.includes('.mjpg') || lower.includes('.mjpeg'))
    return 'mjpeg';
  return 'unknown';
}

function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

function getEntityPictureUrl(entity: HaEntityState | undefined): string | null {
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

  // If it's a path (common: `/api/camera_proxy/...?...token=...`) keep it.
  // In dev, this will go through Vite's `/api` proxy.
  if (raw.startsWith('/')) return raw;

  // Best-effort for odd relative values.
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return null;
  }
}

function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

function canPlayHlsNatively(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  const result = video.canPlayType('application/vnd.apple.mpegurl');
  return result === 'probably' || result === 'maybe';
}

export function CameraStreamModal({ entityId, open, onOpenChange }: CameraStreamModalProps) {
  const cameraService = useService<ICameraService>(TYPES.ICameraService);
  const entitiesById = useEntityStore((s) => s.entitiesById);

  const entity = entitiesById[entityId];
  const cameraName = useMemo(() => getDisplayName(entity), [entity]);
  const entityPictureUrl = useMemo(() => getEntityPictureUrl(entity), [entity]);

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const lastSnapshotUrlRef = useRef<string | null>(null);

  const streamKind = useMemo(() => {
    if (!streamUrl) return null;
    return classifyStreamUrl(streamUrl);
  }, [streamUrl]);

  const shouldUseSnapshotFallback = useMemo(() => {
    // If we can't obtain a stream URL, or if HA gives us HLS but the browser can't play it,
    // fall back to periodically refreshed proxy snapshots.
    if (!streamUrl) return true;
    if (streamKind === 'hls' && !canPlayHlsNatively()) return true;
    return false;
  }, [streamUrl, streamKind]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load(): Promise<void> {
      setError(null);
      setStreamUrl(null);

      if (!cameraService.getStreamUrl) {
        return;
      }

      try {
        const url = await cameraService.getStreamUrl(entityId);
        if (cancelled) return;
        setStreamUrl(url);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load camera stream');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [cameraService, entityId, open]);

  useEffect(() => {
    if (!open) return;
    if (!shouldUseSnapshotFallback) return;

    let cancelled = false;
    let intervalId: number | null = null;

    async function loadSnapshot(): Promise<void> {
      // Preferred: use the entity-provided HA proxy URL (often includes a token).
      // This avoids custom proxy URL construction and avoids requiring auth headers.
      if (entityPictureUrl) {
        setSnapshotUrl(addCacheBuster(entityPictureUrl));
        return;
      }

      // Fallback: blob-fetch via the camera service.
      try {
        const blob = await cameraService.fetchProxyImage(entityId);
        if (cancelled) return;

        const nextUrl = blobToObjectUrl(blob);
        const prev = lastSnapshotUrlRef.current;
        lastSnapshotUrlRef.current = nextUrl;
        setSnapshotUrl(nextUrl);

        if (prev) URL.revokeObjectURL(prev);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load camera snapshot');
      }
    }

    void loadSnapshot();
    intervalId = window.setInterval(() => {
      void loadSnapshot();
    }, 1500);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);

      // Only revoke object URLs when we created them from blobs.
      const prev = lastSnapshotUrlRef.current;
      lastSnapshotUrlRef.current = null;
      setSnapshotUrl(null);
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
    };
  }, [cameraService, entityId, entityPictureUrl, open, shouldUseSnapshotFallback]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        insetPx={40}
        overlayClassName="bg-black/80"
        className="p-4"
      >
        <div className="flex h-full flex-col">
          <div
            className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 pr-14 dark:border-gray-700"
            style={{ padding: '16px' }}
          >
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle>{cameraName || entityId}</DialogTitle>
              <DialogDescription>
                {error ? error : 'Live view'}
                {!error && shouldUseSnapshotFallback ? ' (snapshot fallback)' : ''}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden bg-black">
            {!error && !shouldUseSnapshotFallback && streamUrl && streamKind === 'mjpeg' && (
              <img
                src={streamUrl}
                alt={`Live stream from ${cameraName || entityId}`}
                className="h-full w-full object-contain"
              />
            )}

            {!error && !shouldUseSnapshotFallback && streamUrl && streamKind !== 'mjpeg' && (
              <video
                src={streamUrl}
                className="h-full w-full"
                controls
                autoPlay
                playsInline
                muted
              />
            )}

            {!error && shouldUseSnapshotFallback && snapshotUrl && (
              <img
                src={snapshotUrl}
                alt={`Live view from ${cameraName || entityId}`}
                className="h-full w-full object-contain"
              />
            )}

            {!error && shouldUseSnapshotFallback && !snapshotUrl && (
              <div className="px-6 text-sm text-white/80">Loading…</div>
            )}

            {error && <div className="px-6 text-sm text-white/80">{error}</div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
