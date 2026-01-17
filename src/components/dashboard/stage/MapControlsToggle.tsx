interface MapControlsToggleProps {
  isOpen?: boolean;
  onOpen?: () => void;
}

export function MapControlsToggle({ isOpen, onOpen }: MapControlsToggleProps) {
  const isActuallyOpen = isOpen ?? false;
  const className = `map-controls-toggle${isActuallyOpen ? ' is-hidden' : ''}`;

  return (
    <button
      className={className}
      id="map-controls-toggle"
      type="button"
      aria-label="Show map controls"
      aria-controls="map-controls"
      aria-expanded={isActuallyOpen}
      onClick={() => {
        onOpen?.();
      }}
    >
      {/* Search / magnifying glass icon */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true">
        <g fill="currentColor" stroke="none">
          <path
            d="M256,64
             A192,192 0 1,1 255.999,64
             Z
             M256,124
             A132,132 0 1,0 256,388
             A132,132 0 1,0 256,124 Z"
            fillRule="evenodd"
          />

          <g transform="translate(390 390) rotate(45)">
            <rect x="-12" y="-28" width="150" height="56" rx="8" ry="8" />
            <rect x="132" y="-28" width="28" height="56" />
          </g>
        </g>
      </svg>
    </button>
  );
}
