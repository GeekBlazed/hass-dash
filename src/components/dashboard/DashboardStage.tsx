import { useDashboardStore } from '../../stores/useDashboardStore';
import { FloorplanCanvas } from './stage/FloorplanCanvas';
import { MapControls } from './stage/MapControls';
import { MapControlsToggle } from './stage/MapControlsToggle';
import { StageDevReadout } from './stage/StageDevReadout';

export function DashboardStage({ onRetryFloorplan }: { onRetryFloorplan: () => void }) {
  const isMapControlsOpen = useDashboardStore((s) => s.isMapControlsOpen);
  const setMapControlsOpen = useDashboardStore((s) => s.setMapControlsOpen);
  const stageMediaStreamUrl = useDashboardStore((s) => s.stageMediaStreamUrl);

  return (
    <main className="stage" aria-label="Floorplan">
      {stageMediaStreamUrl ? (
        <div className="stage-stream" aria-label="Live stream stage">
          <iframe
            className="stage-stream__frame"
            src={stageMediaStreamUrl}
            title="Live stream: Firestick 4K 1"
            loading="eager"
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </div>
      ) : (
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
      )}
    </main>
  );
}
