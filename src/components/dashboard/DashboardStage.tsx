import { FloorplanCanvas } from './stage/FloorplanCanvas';
import { MapControls } from './stage/MapControls';
import { MapControlsToggle } from './stage/MapControlsToggle';

export function DashboardStage() {
  return (
    <main className="stage" aria-label="Floorplan">
      <div className="floorplan" aria-label="Interactive SVG floorplan">
        <FloorplanCanvas />
        <MapControlsToggle />
        <MapControls />
      </div>
    </main>
  );
}
