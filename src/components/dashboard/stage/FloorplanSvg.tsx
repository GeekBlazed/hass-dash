export function FloorplanSvg() {
  return (
    <svg id="floorplan-svg" viewBox="0 0 10 10" role="img" aria-label="Home floorplan (from YAML)">
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

        <symbol id="devicePin" viewBox="0 0 64 64">
          <path
            d="M32 3C20.4 3 11 12.4 11 24c0 15.7 17.5 32.7 20.1 35.2.5.5 1.2.8 1.9.8s1.4-.3 1.9-.8C35.5 56.7 53 39.7 53 24 53 12.4 43.6 3 32 3z"
            fill="currentColor"
          />
          <circle cx="32" cy="24" r="16" fill="var(--text-primary)" fillOpacity="0.96" />
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
  );
}
