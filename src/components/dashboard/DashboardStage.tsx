import { useDashboardStore } from '../../stores/useDashboardStore';
import { FloorplanCanvas } from './stage/FloorplanCanvas';
import { MapControls } from './stage/MapControls';
import { MapControlsToggle } from './stage/MapControlsToggle';
import { StageDevReadout } from './stage/StageDevReadout';

export function DashboardStage({ onRetryFloorplan }: { onRetryFloorplan: () => void }) {
  const isMapControlsOpen = useDashboardStore((s) => s.isMapControlsOpen);
  const setMapControlsOpen = useDashboardStore((s) => s.setMapControlsOpen);

  return (
    <main className="stage" aria-label="Floorplan">
      <div className="floorplan" aria-label="Interactive floorplan">
        <FloorplanCanvas onRetry={onRetryFloorplan} />
        <StageDevReadout />
        <MapControlsToggle
          isOpen={isMapControlsOpen}
          onOpen={() => {
            setMapControlsOpen(true);
          }}
        />
        <MapControls
          isOpen={isMapControlsOpen}
          onClose={() => {
            setMapControlsOpen(false);
          }}
        />
      </div>
    </main>
  );
}
