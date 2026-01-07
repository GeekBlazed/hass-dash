export function MapControlsToggle() {
  return (
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
  );
}
