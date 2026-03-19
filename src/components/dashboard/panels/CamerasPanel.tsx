import { useMemo } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { CameraStreamModal } from './CameraStreamModal';

const getDisplayName = (entity: HaEntityState): string => {
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
};

export function CamerasPanel({ isHidden = true }: { isHidden?: boolean }) {
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const hassDashEntityIds = useEntityStore((s) => s.hassDashEntityIds);
  const selectedCameraEntityId = useDashboardStore((s) => s.selectedCameraEntityId);
  const openCameraModal = useDashboardStore((s) => s.openCameraModal);
  const closeCameraModal = useDashboardStore((s) => s.closeCameraModal);

  const cameras = useMemo(() => {
    const allCameras = Object.values(entitiesById).filter((e) => e.entity_id.startsWith('camera.'));
    const hasHassDashFilter = Object.keys(hassDashEntityIds).length > 0;
    const filtered = hasHassDashFilter
      ? allCameras.filter((e) => hassDashEntityIds[e.entity_id] === true)
      : allCameras;

    return filtered
      .map((e) => ({
        id: e.entity_id,
        name: getDisplayName(e),
        state: String(e.state),
        roomId: e.entity_id.startsWith('camera.')
          ? e.entity_id.slice('camera.'.length)
          : e.entity_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entitiesById, hassDashEntityIds]);

  const emptyCopy = useMemo(() => {
    const allCameras = Object.values(entitiesById).filter((e) => e.entity_id.startsWith('camera.'));
    if (allCameras.length === 0) return 'There are no cameras.';

    const hasHassDashFilter = Object.keys(hassDashEntityIds).length > 0;
    if (!hasHassDashFilter) return 'There are no cameras.';

    // Cameras exist, but none are in the hass-dash allow-list.
    return "No cameras match the 'hass-dash' label. Add the label to a camera entity or its device in Home Assistant.";
  }, [entitiesById, hassDashEntityIds]);

  const showEmpty = cameras.length === 0;

  return (
    <section
      id="cameras-panel"
      className={isHidden ? 'tile cameras-panel is-hidden' : 'tile cameras-panel'}
      aria-label="Cameras"
    >
      <ul id="cameras-list" aria-label="Cameras" data-managed-by="react">
        {cameras.map((camera) => (
          <li key={camera.id} className="cameras-item">
            <div className="cameras-item__row">
              <button
                type="button"
                className="cameras-item__details"
                onClick={() => {
                  openCameraModal(camera.id);
                }}
                aria-label={`Open live view for ${camera.name ?? camera.id}`}
              >
                <div className="cameras-name">{camera.name ?? camera.id}</div>
                <div className="cameras-meta">
                  {camera.roomId.replace(/_/g, ' ')}
                  {camera.state ? ` • ${camera.state}` : ''}
                </div>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        className={showEmpty ? 'cameras-panel__empty' : 'cameras-panel__empty is-hidden'}
        id="cameras-empty"
        data-managed-by="react"
      >
        {emptyCopy}
      </div>

      {selectedCameraEntityId && (
        <CameraStreamModal
          entityId={selectedCameraEntityId}
          open={selectedCameraEntityId !== null}
          onOpenChange={(open) => {
            if (!open) closeCameraModal();
          }}
        />
      )}
    </section>
  );
}
