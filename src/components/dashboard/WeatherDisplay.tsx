interface WeatherDisplayProps {
  temperature: number;
  condition: string;
  humidity?: number;
}

function CloudRainIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M24,38 c0,-8 6,-14 14,-14 c6,0 11,4 13,9 c2,-1 4,-2 7,-2 c7,0 12,6 12,13 c0,8 -7,14 -15,14 h-26 c-10,0 -18,-8 -18,-18 c0,-8 5,-15 13,-17" />
      <line x1="30" y1="54" x2="30" y2="62" />
      <line x1="42" y1="54" x2="42" y2="64" />
      <line x1="54" y1="54" x2="54" y2="60" />
    </svg>
  );
}

export function WeatherDisplay({ temperature, condition, humidity }: WeatherDisplayProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="text-text-primary">
        <CloudRainIcon />
      </div>
      <div>
        <div className="text-5xl font-semibold text-text-primary">
          {temperature.toFixed(1)}°C
        </div>
        <div className="mt-1 text-base text-text-secondary">{condition}</div>
        {humidity !== undefined && (
          <div className="mt-1 text-sm text-text-muted">humidity: {humidity}%</div>
        )}
      </div>
    </div>
  );
}
