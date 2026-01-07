import { useMemo } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';

export function ClimatePanel({ isHidden = false }: { isHidden?: boolean }) {
  const thermostat = useDashboardStore((s) => s.climate.thermostat);
  const areas = useDashboardStore((s) => s.climate.areas);

  const measuredTemp = thermostat.measuredTemperature ?? 71;
  const measuredHumidity = thermostat.measuredHumidity ?? 47;
  const mode = thermostat.hvacMode ?? 'cool';
  const modeLabel = mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Cool';

  const { minTemp, maxTemp } = useMemo(() => {
    const temps = Object.values(areas)
      .map((a) => a.temp)
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t));

    if (temps.length === 0) return { minTemp: 68, maxTemp: 78 };

    return {
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
    };
  }, [areas]);

  return (
    <section
      id="climate-panel"
      className={isHidden ? 'tile climate-panel is-hidden' : 'tile climate-panel'}
      aria-label="Climate controls"
    >
      <div className="thermostat" aria-label="Thermostat">
        <div className="thermostat__temp" id="thermostat-temp">
          {Math.round(measuredTemp)}°F
        </div>
        <div className="thermostat__meta">
          <div>
            <strong>Humidity</strong>:{' '}
            <span id="thermostat-humidity">{Math.round(measuredHumidity)}%</span>
          </div>
          <div>
            <strong>Mode</strong>: <span id="thermostat-mode">{modeLabel}</span>
          </div>
        </div>
      </div>

      <div className="temp-range" aria-label="Home temperature range">
        <div className="temp-range__row">
          <span id="temp-range-min">{Math.round(minTemp)}°F</span>
          <span id="temp-range-max">{Math.round(maxTemp)}°F</span>
        </div>
        <div className="temp-range__bar" aria-hidden="true">
          <span
            className="temp-range__indicator"
            id="temp-range-indicator"
            title={`Mode: ${mode}`}
          ></span>
        </div>
      </div>
    </section>
  );
}
