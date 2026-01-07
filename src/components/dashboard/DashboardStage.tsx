import { FloorplanCanvas } from './stage/FloorplanCanvas';
import { MapControls } from './stage/MapControls';
import { MapControlsToggle } from './stage/MapControlsToggle';

export function DashboardStage({ onRetryFloorplan }: { onRetryFloorplan: () => void }) {
  return (
    <main className="stage" aria-label="Floorplan">
      <div className="floorplan" aria-label="Interactive SVG floorplan">
        <FloorplanCanvas onRetry={onRetryFloorplan} />
        <MapControlsToggle />
        <MapControls />
      </div>
    </main>
  );
}
