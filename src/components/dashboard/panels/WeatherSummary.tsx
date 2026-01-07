export function WeatherSummary() {
  return (
    <div className="weather" aria-label="Weather summary">
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
  );
}
