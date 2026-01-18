import { Suspense, lazy, useMemo } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { FloorplanEmptyOverlay } from './FloorplanEmptyOverlay';
import { FloorplanSvg } from './FloorplanSvg';
import { OverlayManager } from './OverlayManager';

const KonvaFloorplanCanvas = lazy(() => import('./KonvaFloorplanCanvas'));

const shouldUseKonva = (): boolean => {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('konva') === '1';
};

export function FloorplanCanvas({ onRetry }: { onRetry: () => void }) {
  const floorplan = useDashboardStore((s) => s.floorplan);

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
          <FloorplanSvg />
          <OverlayManager renderer="svg" />
        </>
      )}
    </>
  );
}
