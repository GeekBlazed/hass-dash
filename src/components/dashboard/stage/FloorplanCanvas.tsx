import { Suspense, lazy, useEffect, useMemo } from 'react';

import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { FloorplanEmptyOverlay } from './FloorplanEmptyOverlay';
import { FloorplanSvg } from './FloorplanSvg';
import { OverlayManager } from './OverlayManager';
import { RoomZoomCanvas } from './RoomZoomCanvas';

const KonvaFloorplanCanvas = lazy(() => import('./KonvaFloorplanCanvas'));

const shouldUseKonva = (): boolean => {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('konva') === '1';
};

export function FloorplanCanvas({ onRetry }: { onRetry: () => void }) {
  const floorplan = useDashboardStore((s) => s.floorplan);
  const roomZoomMode = useDashboardStore((s) => s.roomZoom.mode);
  const finishExitRoomZoom = useDashboardStore((s) => s.finishExitRoomZoom);

  const { isEnabled: isRoomZoomEnabled } = useFeatureFlag('ROOM_ZOOM');

  useEffect(() => {
    // If the feature is turned off at runtime (dev overrides), ensure we exit cleanly.
    if (isRoomZoomEnabled) return;
    if (roomZoomMode === 'none') return;
    finishExitRoomZoom();
  }, [finishExitRoomZoom, isRoomZoomEnabled, roomZoomMode]);

  const useKonva = useMemo(() => shouldUseKonva(), []);

  const isHidden = floorplan.state !== 'error';
  const message = floorplan.errorMessage ?? 'Failed to load floorplan.';

  return (
    <>
      <FloorplanEmptyOverlay isHidden={isHidden} message={message} onRetry={onRetry} />
      {useKonva ? (
        <Suspense fallback={null}>
          <KonvaFloorplanCanvas />
        </Suspense>
      ) : (
        <>
          {isRoomZoomEnabled && roomZoomMode !== 'none' ? (
            <RoomZoomCanvas />
          ) : (
            <FloorplanSvg enableRoomZoom={isRoomZoomEnabled} />
          )}
          <OverlayManager renderer="svg" />
        </>
      )}
    </>
  );
}
