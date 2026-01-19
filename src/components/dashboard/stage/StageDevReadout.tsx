import { useDashboardStore } from '../../../stores/useDashboardStore';
import { clampScale } from './floorplanViewBox';

export function StageDevReadout() {
  const stageView = useDashboardStore((s) => s.stageView);

  // Dev-only diagnostic overlay.
  if (!import.meta.env.DEV) return null;

  const clampedScale = clampScale(stageView.scale);
  const zoomPercent = Math.round(clampedScale * 100);

  const scaleText = clampedScale.toFixed(3);
  const percentText = `(${zoomPercent}%)`;
  const xText = Number.isFinite(stageView.x) ? stageView.x.toFixed(2) : '0';
  const yText = Number.isFinite(stageView.y) ? stageView.y.toFixed(2) : '0';

  return (
    <div className="stage-dev-readout" aria-label="Stage debug readout">
      <div className="stage-dev-readout__line">
        <span className="stage-dev-readout__label">Scale</span>
        <span className="stage-dev-readout__value" id="map-launch-scale">
          {scaleText}
        </span>
        <span className="stage-dev-readout__value" id="map-launch-percent" aria-hidden="true">
          {percentText}
        </span>
      </div>
      <div className="stage-dev-readout__line">
        <span className="stage-dev-readout__label">X</span>
        <span className="stage-dev-readout__value" id="map-launch-x">
          {xText}
        </span>
        <span className="stage-dev-readout__label">Y</span>
        <span className="stage-dev-readout__value" id="map-launch-y">
          {yText}
        </span>
      </div>
    </div>
  );
}
