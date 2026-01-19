import { useMemo, type ChangeEvent } from 'react';

import { getDefaultFloor } from '../../../features/model/floorplan';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { clampScale, computeBaseViewBoxFromFloor } from './floorplanViewBox';
import { getOverlayDefinitions } from './overlayDefinitions';

interface MapControlsProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function MapControls({ isOpen, onClose }: MapControlsProps) {
  const floorplanModel = useDashboardStore((s) => s.floorplan.model);
  const stageView = useDashboardStore((s) => s.stageView);
  const setStageView = useDashboardStore((s) => s.setStageView);
  const stageFontScale = useDashboardStore((s) => s.stageFontScale);
  const setStageFontScale = useDashboardStore((s) => s.setStageFontScale);
  const overlays = useDashboardStore((s) => s.overlays);
  const toggleOverlay = useDashboardStore((s) => s.toggleOverlay);
  const stageFontScaleMin = 50;
  const stageFontScaleMax = 400;
  const zoomMinScale = 50;
  const zoomMaxScale = 300;

  const floor = useMemo(() => {
    if (!floorplanModel) return undefined;
    return getDefaultFloor(floorplanModel);
  }, [floorplanModel]);

  const baseViewBox = useMemo(() => {
    if (!floor) return null;
    return computeBaseViewBoxFromFloor(floor);
  }, [floor]);

  const clampedScale = clampScale(stageView.scale);
  const zoomPercent = Math.round(clampedScale * 100);
  const fontPercent = Math.round(stageFontScale * 100);

  const isActuallyOpen = isOpen ?? false;
  const rootClassName = `map-controls${!isActuallyOpen ? ' is-hidden' : ''}`;

  const panBy = (dx: number, dy: number) => {
    if (!baseViewBox) return;

    const visibleW = baseViewBox.w / clampedScale;
    const visibleH = baseViewBox.h / clampedScale;
    // Match the SVG "grab" pan behavior (see FloorplanSvg panByPixels).
    // Positive dx/dy here should move the content in that direction.
    setStageView({ x: stageView.x - dx * visibleW, y: stageView.y - dy * visibleH });
  };

  const handleZoomPercent = (nextPercent: number) => {
    if (!baseViewBox) return;

    const nextScale = clampScale(nextPercent / 100);

    const prevW = baseViewBox.w / clampedScale;
    const prevH = baseViewBox.h / clampedScale;
    const nextW = baseViewBox.w / nextScale;
    const nextH = baseViewBox.h / nextScale;

    const nextX = stageView.x + (prevW - nextW) / 2;
    const nextY = stageView.y + (prevH - nextH) / 2;

    setStageView({ x: nextX, y: nextY, scale: nextScale });
  };

  const handleFontPercent = (nextPercent: number) => {
    const clamped = Math.max(stageFontScaleMin, Math.min(stageFontScaleMax, nextPercent));
    setStageFontScale(clamped / 100);
  };

  return (
    <div className={rootClassName} id="map-controls" aria-label="Map controls">
      <div className="map-controls__top">
        <div className="map-controls__pan" aria-label="Pan controls">
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-up"
            aria-label="Pan up"
            onClick={() => panBy(0, -0.1)}
          >
            ↑
          </button>
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-down"
            aria-label="Pan down"
            onClick={() => panBy(0, 0.1)}
          >
            ↓
          </button>
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-left"
            aria-label="Pan left"
            onClick={() => panBy(-0.1, 0)}
          >
            ←
          </button>
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-right"
            aria-label="Pan right"
            onClick={() => panBy(0.1, 0)}
          >
            →
          </button>
        </div>
        <button
          className="map-controls__close"
          type="button"
          id="map-controls-close"
          aria-label="Hide map controls"
          onClick={() => {
            onClose?.();
          }}
        >
          ✕
        </button>
      </div>
      <div className="map-controls__sliders" aria-label="Zoom and font controls">
        <div className="map-controls__zoom">
          <div className="map-controls__zoom-head">
            <label className="map-controls__label" htmlFor="map-zoom">
              Zoom
            </label>
            <div className="map-controls__value" id="map-zoom-value" aria-hidden="true">
              {`${zoomPercent}%`}
            </div>
          </div>
          <input
            id="map-zoom"
            className="map-controls__slider"
            type="range"
            min={zoomMinScale}
            max={zoomMaxScale}
            value={zoomPercent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleZoomPercent(Number(e.target.value));
            }}
            step="1"
            aria-label="Zoom"
          />
        </div>

        <div className="map-controls__zoom">
          <div className="map-controls__zoom-head">
            <label className="map-controls__label" htmlFor="map-font-scale">
              Font size
            </label>
            <div className="map-controls__value" id="map-font-scale-value" aria-hidden="true">
              {`${fontPercent}%`}
            </div>
          </div>
          <input
            id="map-font-scale"
            className="map-controls__slider"
            type="range"
            min={stageFontScaleMin}
            max={stageFontScaleMax}
            value={fontPercent}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              handleFontPercent(Number(e.target.value));
            }}
            step="1"
            aria-label="Font size"
          />
        </div>
      </div>

      <div className="map-controls__divider" role="separator" aria-hidden="true" />

      <div className="map-controls__overlays" aria-label="Overlays">
        <div className="map-controls__overlays-head">
          <span className="map-controls__label">Overlays</span>
        </div>
        <div className="map-controls__overlays-row">
          {getOverlayDefinitions().map((overlay) => {
            const isEnabled = overlays[overlay.id];
            return (
              <button
                key={overlay.id}
                className="map-controls__overlay-btn"
                type="button"
                aria-pressed={isEnabled}
                aria-label={`Toggle ${overlay.label} overlay`}
                onClick={() => {
                  toggleOverlay(overlay.id);
                }}
              >
                {overlay.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
