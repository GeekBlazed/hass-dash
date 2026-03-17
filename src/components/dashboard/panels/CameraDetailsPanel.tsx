import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ICameraService } from '../../../interfaces/ICameraService';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityId, HaEntityState } from '../../../types/home-assistant';

const getDisplayName = (entity: HaEntityState): string => {
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
};

const blobToDisplayUrl = async (blob: Blob): Promise<{ url: string; revoke: () => void }> => {
  const canObjectUrl =
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof URL.revokeObjectURL === 'function';

  if (canObjectUrl) {
    const url = URL.createObjectURL(blob);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }

  // Fallback for environments that don't implement URL.createObjectURL (e.g. some test runners).
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read camera snapshot data.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });

  return { url: dataUrl, revoke: () => undefined };
};

export function CameraDetailsPanel({
  entityId,
  onBack,
  backLabel = 'Back',
  backAriaLabel = 'Back to cameras',
}: {
  entityId: string;
  onBack: () => void;
  backLabel?: string;
  backAriaLabel?: string;
}) {
  const cameraService = useService<ICameraService>(TYPES.ICameraService);
  const entity = useEntityStore((s) => s.entitiesById[entityId]);

  const name = useMemo(() => {
    if (!entity) return entityId;
    return getDisplayName(entity);
  }, [entity, entityId]);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const revokeRef = useRef<(() => void) | null>(null);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const blob = await cameraService.fetchProxyImage(entityId as HaEntityId);
      if (!mountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      revokeRef.current?.();
      const { url, revoke } = await blobToDisplayUrl(blob);
      if (!mountedRef.current) {
        revoke();
        return;
      }
      if (requestId !== requestIdRef.current) {
        revoke();
        return;
      }

      revokeRef.current = revoke;
      setImageUrl(url);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      if (requestId !== requestIdRef.current) return;

      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message || 'Failed to load camera snapshot.');
    } finally {
      const shouldUpdate = mountedRef.current && requestId === requestIdRef.current;
      if (shouldUpdate) setIsLoading(false);
    }
  }, [cameraService, entityId]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      revokeRef.current?.();
      revokeRef.current = null;
    };
  }, [refresh]);

  if (!entity) return null;

  return (
    <div className="camera-details" aria-label={`Camera details for ${name}`}>
      <div className="camera-details__header">
        <button
          type="button"
          className="camera-details__back"
          onClick={onBack}
          aria-label={backAriaLabel}
        >
          {backLabel}
        </button>
        <div className="camera-details__title">{name}</div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="border-danger-dark/40 bg-danger-dark/10 text-danger-light mx-4 mt-3 rounded-md border px-3 py-2 text-sm"
        >
          {errorMessage}
        </div>
      )}

      <div className="camera-details__preview" aria-label="Camera preview">
        {imageUrl ? (
          <img src={imageUrl} alt={`Snapshot from ${name}`} className="camera-details__image" />
        ) : isLoading ? (
          <div className="camera-details__loading">Loading…</div>
        ) : (
          <div className="camera-details__empty">No preview available.</div>
        )}
      </div>

      <div className="camera-details__actions">
        <button
          type="button"
          className="camera-details__refresh"
          onClick={() => void refresh()}
          aria-label="Refresh camera snapshot"
          disabled={isLoading}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
