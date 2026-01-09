import { useDashboardStore } from '../../../stores/useDashboardStore';
import { FloorplanEmptyOverlay } from './FloorplanEmptyOverlay';
import { FloorplanSvg } from './FloorplanSvg';
import { TrackedDeviceMarkersBridge } from './TrackedDeviceMarkersBridge';

export function FloorplanCanvas({ onRetry }: { onRetry: () => void }) {
  const floorplan = useDashboardStore((s) => s.floorplan);

  const isHidden = floorplan.state !== 'error';
  const message = floorplan.errorMessage ?? 'Failed to load floorplan.';

  return (
    <>
      <FloorplanEmptyOverlay isHidden={isHidden} message={message} onRetry={onRetry} />
      <FloorplanSvg />
      <TrackedDeviceMarkersBridge />
    </>
  );
}
