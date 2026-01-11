export function MapControls() {
  return (
    <div className="map-controls" id="map-controls" aria-label="Map controls">
      <div className="map-controls__top">
        <div className="map-controls__camera" aria-label="Launch view values">
          <div className="map-controls__camera-line">
            <span className="map-controls__label">Scale</span>
            <span className="map-controls__value" id="map-launch-scale">
              1.000
            </span>
            <span className="map-controls__value" id="map-launch-percent" aria-hidden="true">
              (100%)
            </span>
          </div>
          <div className="map-controls__camera-line">
            <span className="map-controls__label">X</span>
            <span className="map-controls__value" id="map-launch-x">
              0
            </span>
            <span className="map-controls__label">Y</span>
            <span className="map-controls__value" id="map-launch-y">
              0
            </span>
          </div>
        </div>
        <button
          className="map-controls__close"
          type="button"
          id="map-controls-close"
          aria-label="Hide map controls"
        >
          ✕
        </button>
      </div>
      <div className="map-controls__row">
        <div className="map-controls__stack" aria-label="Pan up/down">
          <button className="map-controls__btn" type="button" id="map-pan-up" aria-label="Pan up">
            ↑
          </button>
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-down"
            aria-label="Pan down"
          >
            ↓
          </button>
        </div>

        <div className="map-controls__zoom">
          <div className="map-controls__zoom-head">
            <label className="map-controls__label" htmlFor="map-zoom">
              Zoom
            </label>
            <div className="map-controls__value" id="map-zoom-value" aria-hidden="true">
              100%
            </div>
          </div>
          <input
            id="map-zoom"
            className="map-controls__slider"
            type="range"
            min="50"
            max="300"
            defaultValue={100}
            step="1"
            aria-label="Zoom"
          />
        </div>

        <div className="map-controls__stack" aria-label="Pan right/left">
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-right"
            aria-label="Pan right"
          >
            →
          </button>
          <button
            className="map-controls__btn"
            type="button"
            id="map-pan-left"
            aria-label="Pan left"
          >
            ←
          </button>
        </div>
      </div>
    </div>
  );
}
