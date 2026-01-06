type View = {
  x: number;
  y: number;
  scale: number;
};

type ClimateSummary = {
  familyTempLabel: string;
  kitchenTempLabel: string;
  bedroomTempLabel: string;
  officeTempLabel: string;
};

export interface PrototypeStageProps {
  view: View;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  showClimateOverlay: boolean;
  showLightingOverlay: boolean;
  climateSummary: ClimateSummary;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function PrototypeStage({
  view,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  showClimateOverlay,
  showLightingOverlay,
  climateSummary,
  onZoomIn,
  onZoomOut,
  onResetView,
}: PrototypeStageProps) {
  const viewportTransform = `translate(${view.x} ${view.y}) scale(${view.scale})`;

  return (
    <main aria-label="Stage" data-testid="prototype-stage" className="proto-panel proto-stage">
      <div className="absolute inset-0 p-[22px] pb-[26px]" aria-label="Interactive SVG floorplan">
        <svg
          data-testid="floorplan-svg"
          viewBox="0 0 1000 650"
          className="h-full w-full"
          role="img"
          aria-label="Floorplan"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g data-testid="floorplan-viewport" transform={viewportTransform}>
            {/* Base rooms layer */}
            <g data-testid="base-layer">
              <rect x="60" y="60" width="420" height="260" rx="16" fill="var(--proto-room-fill)" />
              <rect x="520" y="60" width="420" height="260" rx="16" fill="var(--proto-room-fill)" />
              <rect x="60" y="350" width="420" height="240" rx="16" fill="var(--proto-room-fill)" />
              <rect
                x="520"
                y="350"
                width="420"
                height="240"
                rx="16"
                fill="var(--proto-room-fill)"
              />

              <text x="90" y="120" fill="var(--proto-room-title)" fontSize="22">
                Living Room
              </text>
              <text x="550" y="120" fill="var(--proto-room-title)" fontSize="22">
                Kitchen
              </text>
              <text x="90" y="410" fill="var(--proto-room-title)" fontSize="22">
                Bedroom
              </text>
              <text x="550" y="410" fill="var(--proto-room-title)" fontSize="22">
                Office
              </text>
            </g>

            {/* Climate overlay layer */}
            <g
              data-testid="climate-overlay"
              className={showClimateOverlay ? '' : 'hidden'}
              aria-label="Climate overlay"
            >
              <text x="90" y="160" fill="var(--proto-room-subtext)" fontSize="18">
                {climateSummary.familyTempLabel}
              </text>
              <text x="550" y="160" fill="var(--proto-room-subtext)" fontSize="18">
                {climateSummary.kitchenTempLabel}
              </text>
              <text x="90" y="450" fill="var(--proto-room-subtext)" fontSize="18">
                {climateSummary.bedroomTempLabel}
              </text>
              <text x="550" y="450" fill="var(--proto-room-subtext)" fontSize="18">
                {climateSummary.officeTempLabel}
              </text>
            </g>

            {/* Lighting overlay layer */}
            <g data-testid="lighting-overlay" className={showLightingOverlay ? '' : 'hidden'}>
              <circle cx="440" cy="290" r="12" fill="var(--proto-accent)" />
              <circle cx="900" cy="290" r="12" fill="var(--proto-accent)" />
              <circle cx="440" cy="560" r="12" fill="var(--proto-accent)" />
              <circle cx="900" cy="560" r="12" fill="var(--proto-accent)" />
            </g>
          </g>
        </svg>
      </div>

      <div
        className="absolute right-[18px] bottom-[18px] flex flex-col gap-2"
        role="group"
        aria-label="Map controls"
      >
        <button
          type="button"
          onClick={onZoomIn}
          className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={onResetView}
          className="bg-panel-surface/30 text-text-primary hover:border-accent/30 hover:bg-panel-surface/40 focus-visible:ring-accent/50 h-11 w-11 rounded-2xl border border-white/10 shadow-xl backdrop-blur-md focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Reset view"
        >
          ↺
        </button>
      </div>
    </main>
  );
}
