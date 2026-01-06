export function Dashboard() {
  return (
    <div className="viewport">
      {/* component */}
      <div className="frame" role="application" aria-label="Floorplan prototype">
        {/* component */}
        <div className="app">
          {/* component */}
          <aside className="sidebar" aria-label="Home controls">
            {/* component */}
            <div className="brand">
              {/* component */}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M10.5 20v-6h3v6h4.5v-8h2L12 3 1 12h2v8z" />
              </svg>
              <div className="title">Home</div>
            </div>

            <div className="weather" aria-label="Weather summary">
              {/* component */}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M6 14.5a4.5 4.5 0 0 1 4.43-4.5A5.5 5.5 0 0 1 21 12.5a4.5 4.5 0 0 1-4.5 4.5H7.5A3.5 3.5 0 0 1 6 14.5zm4.5 4.5h2l-1 3h-2l1-3zm4 0h2l-1 3h-2l1-3z"
                />
              </svg>
              <div>
                <div className="temp">89°F</div>
                <div className="desc">Breezy and foggy for the hour</div>
                <div className="meta">Humidity: 97%</div>
              </div>
            </div>

            <div className="quick-actions" aria-label="Quick actions">
              {/* component */}
              <button
                className="qa"
                type="button"
                id="lighting-toggle"
                aria-label="Lighting"
                aria-controls="lighting-panel"
                aria-expanded="false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-20C8.13 1 5 4.13 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26C17.81 12.47 19 10.38 19 8c0-3.87-3.13-7-7-7z"
                  />
                </svg>
                <div className="label">Lighting</div>
              </button>
              <button
                className="qa"
                type="button"
                id="climate-toggle"
                aria-label="Climate"
                aria-controls="climate-panel"
                aria-expanded="true"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM1 13h3v-2H1v2zm10 10h2v-3h-2v3zm9.04-18.95-1.41-1.41-1.8 1.79 1.42 1.42 1.79-1.8zM20 11v2h3v-2h-3zM6.76 19.16l-1.42-1.42-1.79 1.8 1.41 1.41 1.8-1.79zM17.24 19.16l1.8 1.79 1.41-1.41-1.79-1.8-1.42 1.42zM12 6a6 6 0 1 0 0 12a6 6 0 0 0 0-12zm0-5h0v3h0V1z"
                  />
                </svg>
                <div className="label">Climate</div>
              </button>
              <button
                className="qa"
                type="button"
                id="media-toggle"
                aria-label="Media"
                aria-controls="media-window"
                aria-expanded="false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {/* Video/film frame */}
                  <path
                    fill="currentColor"
                    d="M4 5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H4zm0 2h10v10H4V7z"
                  />
                  {/* Film perforations */}
                  <path
                    fill="currentColor"
                    d="M5 8h1v1H5V8zm0 2h1v1H5v-1zm0 2h1v1H5v-1zm0 2h1v1H5v-1z"
                  />
                  {/* Play triangle in the frame */}
                  <path fill="currentColor" d="M9 10.2v3.6L12 12l-3-1.8z" />
                  {/* Music note overlay */}
                  <path
                    fill="currentColor"
                    d="M20 6v8.6a2.2 2.2 0 1 1-1.6-2.1V8.6l-4 1V7.9l5.6-1.4z"
                  />
                </svg>
                <div className="label">Media</div>
              </button>
              <a className="qa" href="#top" aria-label="Security (prototype)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 1l9 4v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V5l9-4zm0 4.18L5 7.5V11c0 4.52 2.98 8.84 7 10 4.02-1.16 7-5.48 7-10V7.5l-7-2.32z"
                  />
                </svg>
                <div className="label">Security</div>
              </a>
              <a className="qa" href="#top" aria-label="Cameras (prototype)">
                <svg viewBox="0 0 401.931 401.931" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M395.928,187.794l-272.1-135.687c-5.358-2.669-11.866-0.494-14.538,4.864L51.24,173.379c-1.283,2.573-1.491,5.55-0.579,8.276c0.912,2.727,2.869,4.979,5.443,6.262l81.242,40.511l-7.208,14.455c-2.671,5.358-0.494,11.866,4.864,14.538l2.561,1.278l-13.998,24.929H41.027C33.351,268.782,17.867,258.626,0,258.626v92.338c17.454,0,32.642-9.688,40.49-23.978h95.766c7.838,0,15.065-4.229,18.903-11.063l21.255-37.85l3.695,1.842c5.357,2.671,11.867,0.493,14.539-4.863l7.208-14.455l60.7,30.271c3.501,1.746,7.671,1.471,10.911-0.723l16.753-11.332l29.912,14.916c1.518,0.758,3.174,1.14,4.837,1.14c1.159,0,2.32-0.188,3.439-0.562c2.727-0.91,4.979-2.869,6.262-5.441l30.624-61.413l31.757-20.903c3.239-2.132,5.092-5.832,4.86-9.702C401.679,192.976,399.397,189.525,395.928,187.794z"
                  />
                </svg>
                <div className="label">Cameras</div>
              </a>
              <button
                className="qa"
                type="button"
                id="agenda-toggle"
                aria-label="Agenda"
                aria-controls="agenda"
                aria-expanded="false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"
                  />
                </svg>
                <div className="label">Agenda</div>
              </button>
            </div>

            <div className="agenda is-hidden" id="agenda" aria-label="Agenda">
              {/* component */}
              <div className="item">
                <div className="name">Weekend In</div>
                <div className="time">Until 7:00 PM</div>
              </div>
              <div className="item">
                <div className="name">Lunch at the park</div>
                <div className="time">11:00 AM – 2:00 PM</div>
              </div>
              <div className="item">
                <div className="name">Install New Home Batteries and Solar</div>
                <div className="time">All Day</div>
              </div>
              <div className="item">
                <div className="name">Take Out Garbage</div>
                <div className="time">All Day</div>
              </div>
              <div className="item">
                <div className="name">Farmers Market</div>
                <div className="time">All Day</div>
              </div>
            </div>

            <section
              id="lighting-panel"
              className="tile lighting-panel is-hidden"
              aria-label="Lighting"
            >
              {/* component */}
              <ul id="lighting-list" aria-label="Lights currently on"></ul>
              <div className="lighting-panel__empty is-hidden" id="lighting-empty">
                There are no lights on.
              </div>
            </section>

            <section
              id="media-window"
              className="tile media-window is-hidden"
              aria-label="Media player"
            >
              {/* component */}
              <div className="media-window__header" aria-label="Media window header">
                <div className="media-window__title">
                  <span className="media-window__pill">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="rgba(234,231,223,0.85)"
                        d="M12 3c5 0 9 4 9 9s-4 9-9 9-9-4-9-9 4-9 9-9zm-1 5v8l7-4-7-4z"
                      />
                    </svg>
                    Spotify
                  </span>
                </div>
              </div>

              <div className="media" aria-label="Now playing">
                <div className="track" id="media-track">
                  All Along the Wa...
                </div>
                <div className="artist" id="media-artist">
                  Jimmi Hendrix
                </div>
              </div>

              <div className="controls" aria-label="Media controls">
                <div className="buttons" role="group" aria-label="Playback">
                  <div className="btn" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="rgba(234,231,223,0.85)"
                        d="M11 18V6l-8.5 6L11 18zm1-12v12h2V6h-2z"
                      />
                    </svg>
                  </div>
                  <div className="btn" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="rgba(234,231,223,0.85)" d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="btn" aria-hidden="true">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="rgba(234,231,223,0.85)" d="M13 6v12l8.5-6L13 6zM4 18h2V6H4v12z" />
                    </svg>
                  </div>
                </div>
                <div className="scrub" aria-hidden="true">
                  <span></span>
                </div>
              </div>
            </section>

            <section
              id="climate-panel"
              className="tile climate-panel"
              aria-label="Climate controls"
            >
              {/* component */}
              <div className="thermostat" aria-label="Thermostat">
                <div className="thermostat__temp" id="thermostat-temp">
                  71°F
                </div>
                <div className="thermostat__meta">
                  <div>
                    <strong>Humidity</strong>: <span id="thermostat-humidity">47%</span>
                  </div>
                  <div>
                    <strong>Mode</strong>: <span id="thermostat-mode">Cool</span>
                  </div>
                </div>
              </div>

              <div className="temp-range" aria-label="Home temperature range">
                <div className="temp-range__row">
                  <span id="temp-range-min">68°F</span>
                  <span id="temp-range-max">78°F</span>
                </div>
                <div className="temp-range__bar" aria-hidden="true">
                  <span
                    className="temp-range__indicator"
                    id="temp-range-indicator"
                    title="Setpoint: 71°F"
                  ></span>
                </div>
              </div>
            </section>

            <pre className="status-block" id="floorplan-status"></pre>
          </aside>

          <main className="stage" aria-label="Floorplan">
            {/* component */}
            <div className="floorplan" aria-label="Interactive SVG floorplan">
              {/* component */}
              <div
                className="floorplan-empty is-hidden"
                id="floorplan-empty"
                role="alert"
                aria-live="polite"
              >
                <div className="floorplan-empty__panel">
                  <h2 className="floorplan-empty__title">Floorplan not loaded</h2>
                  <p className="floorplan-empty__body" id="floorplan-empty-message"></p>
                  <div className="floorplan-empty__actions">
                    <button className="floorplan-empty__btn" id="floorplan-retry" type="button">
                      Try again
                    </button>
                  </div>
                </div>
              </div>

              <svg
                id="floorplan-svg"
                viewBox="0 0 10 10"
                role="img"
                aria-label="Home floorplan (from YAML)"
              >
                <defs>
                  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                    <feColorMatrix
                      in="blur"
                      type="matrix"
                      values="1 0 0 0 0.12  0 1 0 0 0.08  0 0 1 0 0  0 0 0 1 0"
                      result="tint"
                    />
                    <feMerge>
                      <feMergeNode in="tint" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Inner glow for room polygons (accent color; clipped to the inside of the shape) */}
                  <filter
                    id="roomInnerGlow"
                    x="-5%"
                    y="-5%"
                    width="95%"
                    height="95%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
                    <feComposite in="blur" in2="SourceAlpha" operator="in" result="innerBlur" />
                    <feFlood floodColor="#ffb65c" floodOpacity="0.28" result="glowColor" />
                    <feComposite in="glowColor" in2="innerBlur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <linearGradient id="wall" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
                    <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
                  </linearGradient>

                  <linearGradient id="floorWood" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="rgba(255, 182, 92, 0.08)" />
                    <stop offset="1" stopColor="rgba(0, 0, 0, 0)" />
                  </linearGradient>

                  {/* Device/person pin marker (outer color = currentColor) */}
                  <symbol id="devicePin" viewBox="0 0 64 64">
                    <defs>
                      <clipPath id="devicePersonClip">
                        <circle cx="32" cy="24" r="15.8" />
                      </clipPath>
                    </defs>
                    <path
                      d="M32 3C20.4 3 11 12.4 11 24c0 15.7 17.5 32.7 20.1 35.2.5.5 1.2.8 1.9.8s1.4-.3 1.9-.8C35.5 56.7 53 39.7 53 24 53 12.4 43.6 3 32 3z"
                      fill="currentColor"
                    />
                    <circle cx="32" cy="24" r="16" fill="var(--text-primary)" fillOpacity="0.96" />
                    <g clipPath="url(#devicePersonClip)">
                      <circle cx="32" cy="21" r="6.2" fill="var(--panel-bg)" fillOpacity="0.72" />
                      <path
                        d="M20.5 40.5c2.9-6.4 9-9.8 11.5-9.8s8.6 3.4 11.5 9.8"
                        fill="none"
                        stroke="var(--panel-bg)"
                        strokeOpacity="0.72"
                        strokeWidth="7.2"
                        strokeLinecap="round"
                      />
                    </g>
                    <circle
                      cx="32"
                      cy="24"
                      r="16"
                      fill="none"
                      stroke="var(--panel-bg)"
                      strokeOpacity="0.2"
                      strokeWidth="1.2"
                    />
                  </symbol>

                  {/* Light bulb icon (used for room toggle buttons) */}
                  <symbol id="lightBulb" viewBox="0 0 24 24">
                    <path
                      d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-20C8.13 1 5 4.13 5 8c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-3.26C17.81 12.47 19 10.38 19 8c0-3.87-3.13-7-7-7z"
                      fill="currentColor"
                    />
                  </symbol>
                </defs>
                <g id="walls-layer"></g>
                <g id="labels-layer"></g>
                <g id="lights-layer"></g>
                <g id="nodes-layer"></g>
                <g id="devices-layer"></g>
              </svg>

              <button
                className="map-controls-toggle is-hidden"
                id="map-controls-toggle"
                type="button"
                aria-label="Show map controls"
                aria-controls="map-controls"
                aria-expanded="false"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M10.5 3a7.5 7.5 0 1 1 4.52 13.5l3.74 3.74a1 1 0 0 1-1.42 1.42l-3.74-3.74A7.5 7.5 0 0 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11z"
                  />
                </svg>
              </button>

              <div className="map-controls" id="map-controls" aria-label="Map controls">
                <div className="map-controls__top">
                  <div className="map-controls__camera" aria-label="Launch view values">
                    <div className="map-controls__camera-line">
                      <span className="map-controls__label">Scale</span>
                      <span className="map-controls__value" id="map-launch-scale">
                        1.000
                      </span>
                      <span
                        className="map-controls__value"
                        id="map-launch-percent"
                        aria-hidden="true"
                      >
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
                    <button
                      className="map-controls__btn"
                      type="button"
                      id="map-pan-up"
                      aria-label="Pan up"
                    >
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
                      value="100"
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
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
