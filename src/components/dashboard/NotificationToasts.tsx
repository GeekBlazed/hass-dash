import { useEffect, useMemo } from 'react';

import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { parseMaxVisibleToasts, useNotificationStore } from '../../stores/useNotificationStore';
import { renderNotificationContentHtml } from '../../utils/notificationContentRenderer';

const toOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveCameraPreviewUrl = (
  cameraEntityId: string,
  entitiesById: Record<string, { attributes?: Record<string, unknown> }>
): string | undefined => {
  const entity = entitiesById[cameraEntityId];
  const attrs = (entity?.attributes ?? {}) as Record<string, unknown>;
  const raw = toOptionalText(attrs.entity_picture);
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
    if (raw.startsWith('/api/camera_proxy/')) {
      return raw.replace('/api/camera_proxy/', '/api/camera_proxy_stream/');
    }
    return raw;
  }

  return undefined;
};

const inferCameraEntityIdBySourceHeuristic = (
  sourceEntityId: string,
  entitiesById: Record<string, { attributes?: Record<string, unknown> }>
): string | undefined => {
  const cameraEntityIds = Object.keys(entitiesById).filter((id) => id.startsWith('camera.'));
  if (cameraEntityIds.length === 0) return undefined;

  const normalizedSource = sourceEntityId.toLowerCase();
  const sourceTokens = normalizedSource.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);

  let best: { id: string; score: number } | null = null;
  for (const candidate of cameraEntityIds) {
    const normalizedCandidate = candidate.toLowerCase();
    let score = 0;

    for (const token of sourceTokens) {
      if (normalizedCandidate.includes(token)) score += 1;
    }

    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { id: candidate, score };
    }
  }

  return best?.id;
};

const inferCandidatesFromSourceEntity = (sourceEntityId: string): string[] => {
  const candidates = new Set<string>();

  if (sourceEntityId.startsWith('binary_sensor.')) {
    const rawName = sourceEntityId.slice('binary_sensor.'.length);
    const suffixes = ['_person', '_motion', '_vehicle', '_animal', '_package'];

    for (const suffix of suffixes) {
      if (!rawName.endsWith(suffix)) continue;

      const base = rawName.slice(0, -suffix.length);
      if (!base) continue;

      candidates.add(`camera.${base}`);

      if (base.endsWith('_camera')) {
        const stem = base.slice(0, -'_camera'.length);
        if (stem) {
          candidates.add(`camera.${stem}`);
        }
      }
    }
  }

  if (sourceEntityId.startsWith('event.')) {
    const rawName = sourceEntityId.slice('event.'.length);
    candidates.add(`camera.${rawName}`);

    if (rawName.endsWith('_camera')) {
      const stem = rawName.slice(0, -'_camera'.length);
      if (stem) {
        candidates.add(`camera.${stem}`);
      }
    }
  }

  return Array.from(candidates);
};

const resolveCameraEntityId = (
  payload: Record<string, unknown> | undefined,
  entitiesById: Record<string, { attributes?: Record<string, unknown> }>
): string | undefined => {
  const candidates: string[] = [];

  const direct = toOptionalText(payload?.cameraEntityId);
  if (direct?.startsWith('camera.')) {
    candidates.push(direct);
  }

  const sourceEntityIdFromPayload = toOptionalText(payload?.sourceEntityId);
  if (sourceEntityIdFromPayload) {
    candidates.push(...inferCandidatesFromSourceEntity(sourceEntityIdFromPayload));
  }

  for (const candidate of candidates) {
    if (candidate in entitiesById) {
      return candidate;
    }
  }

  if (sourceEntityIdFromPayload) {
    const heuristic = inferCameraEntityIdBySourceHeuristic(sourceEntityIdFromPayload, entitiesById);
    if (heuristic) return heuristic;
  }

  // Keep CTA available even when we can't verify entity presence from the local cache.
  return candidates[0];
};

const fallbackPreviewUrlForCameraEntityId = (cameraEntityId: string): string => {
  return `/api/camera_proxy_stream/${cameraEntityId}`;
};

export function NotificationToasts() {
  const { isEnabled: notificationsEnabled } = useFeatureFlag('NOTIFICATIONS');
  const { isEnabled: toastsEnabled } = useFeatureFlag('NOTIFICATIONS_TOASTS');

  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const pruneExpiredToasts = useNotificationStore((s) => s.pruneExpiredToasts);
  const setActivePanel = useDashboardStore((s) => s.setActivePanel);
  const openCameraModal = useDashboardStore((s) => s.openCameraModal);
  const entitiesById = useEntityStore((s) => s.entitiesById);

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

  const previewByToastId = useMemo(() => {
    const map: Record<string, { cameraEntityId: string; previewUrl?: string }> = {};

    for (const toast of visible) {
      if (toast.action?.type !== 'open-camera') continue;

      const cameraEntityId = resolveCameraEntityId(toast.action.payload, entitiesById);
      if (!cameraEntityId) continue;

      const previewUrl =
        resolveCameraPreviewUrl(cameraEntityId, entitiesById) ??
        fallbackPreviewUrlForCameraEntityId(cameraEntityId);

      map[toast.id] = {
        cameraEntityId,
        previewUrl,
      };
    }

    return map;
  }, [entitiesById, visible]);

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

            {previewByToastId[item.id] && (
              <button
                type="button"
                className="notification-toasts__camera-preview"
                onClick={() => {
                  const cameraEntityId = previewByToastId[item.id]?.cameraEntityId;
                  if (!cameraEntityId) return;

                  setActivePanel('cameras');
                  openCameraModal(cameraEntityId);
                  dismissToast(item.id);
                }}
                aria-label={`Open camera feed for ${previewByToastId[item.id]?.cameraEntityId}`}
              >
                {previewByToastId[item.id]?.previewUrl ? (
                  <img
                    src={previewByToastId[item.id]?.previewUrl}
                    alt=""
                    className="notification-toasts__image"
                    loading="lazy"
                  />
                ) : (
                  <span className="notification-toasts__camera-preview-label">
                    Open camera feed
                  </span>
                )}
              </button>
            )}

            <div
              className="notification-toasts__body"
              dangerouslySetInnerHTML={{ __html: renderNotificationContentHtml(item.content) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
