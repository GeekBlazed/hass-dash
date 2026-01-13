import { useMemo } from 'react';

import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';

const readNumber = (entity: HaEntityState | undefined): number | undefined => {
  if (!entity) return undefined;
  const value = Number.parseFloat(entity.state);
  return Number.isFinite(value) ? value : undefined;
};

const readUnit = (entity: HaEntityState | undefined): string => {
  const unit = (entity?.attributes as { unit_of_measurement?: unknown } | undefined)
    ?.unit_of_measurement;
  return typeof unit === 'string' && unit.trim() ? unit.trim() : '°F';
};

export function ClimatePanel({ isHidden = false }: { isHidden?: boolean }) {
  const meanEntity = useEntityStore(
    (s) => s.entitiesById['sensor.household_temperature_mean_weighted']
  );
  const minEntity = useEntityStore((s) => s.entitiesById['sensor.household_temperature_minimum']);
  const maxEntity = useEntityStore((s) => s.entitiesById['sensor.household_temperature_maximum']);

  const unit = useMemo(
    () => readUnit(meanEntity ?? minEntity ?? maxEntity),
    [meanEntity, minEntity, maxEntity]
  );
  const measuredTemp = readNumber(meanEntity);
  const measuredHumidity = undefined;
  const modeLabel = '—';

  const { minTemp, maxTemp } = useMemo(() => {
    const minTempValue = readNumber(minEntity);
    const maxTempValue = readNumber(maxEntity);

    return {
      minTemp: minTempValue,
      maxTemp: maxTempValue,
    };
  }, [minEntity, maxEntity]);

  return (
    <section
      id="climate-panel"
      className={isHidden ? 'tile climate-panel is-hidden' : 'tile climate-panel'}
      aria-label="Climate controls"
    >
      <div className="thermostat" aria-label="Thermostat">
        <div className="thermostat__temp" id="thermostat-temp" data-managed-by="react">
          {typeof measuredTemp === 'number' ? `${Math.round(measuredTemp)}${unit}` : `—${unit}`}
        </div>
        <div className="thermostat__meta">
          <div>
            <strong>Humidity</strong>:{' '}
            <span id="thermostat-humidity" data-managed-by="react">
              {typeof measuredHumidity === 'number' ? `${Math.round(measuredHumidity)}%` : '—'}
            </span>
          </div>
          <div>
            <strong>Mode</strong>:{' '}
            <span id="thermostat-mode" data-managed-by="react">
              {modeLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="temp-range" aria-label="Home temperature range">
        <div className="temp-range__row">
          <span id="temp-range-min" data-managed-by="react">
            {typeof minTemp === 'number' ? `${Math.round(minTemp)}${unit}` : `—${unit}`}
          </span>
          <span id="temp-range-max" data-managed-by="react">
            {typeof maxTemp === 'number' ? `${Math.round(maxTemp)}${unit}` : `—${unit}`}
          </span>
        </div>
        <div className="temp-range__bar" aria-hidden="true">
          <span
            className="temp-range__indicator"
            id="temp-range-indicator"
            data-managed-by="react"
            title="Mode: —"
          ></span>
        </div>
      </div>
    </section>
  );
}
