import { useMemo } from 'react';

import {
  DEFAULT_AREA_TEMP_ENTITY_CANDIDATES,
  getAreaClimateEntityMappingFromEnv,
} from '../../../features/climate/areaClimateEntityMapping';
import { useEntityStore } from '../../../stores/useEntityStore';
import { useHouseholdAreaEntityIndexStore } from '../../../stores/useHouseholdAreaEntityIndexStore';
import type { HaEntityState } from '../../../types/home-assistant';

type SensorKind = 'temperature' | 'humidity';

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

const isPercent = (entity: HaEntityState | undefined): boolean => {
  return readUnit(entity) === '%';
};

const readPercentNumber = (entity: HaEntityState | undefined): number | undefined => {
  if (!entity) return undefined;
  const value = readNumber(entity);
  if (typeof value !== 'number') return undefined;
  if (!isPercent(entity)) return undefined;
  // Some HA template sensors use sentinel values (e.g. -100) to indicate "unknown".
  if (value < 0 || value > 100) return undefined;
  return value;
};

const formatPercent = (value: number): string => {
  // Keep one decimal when present (e.g. 43.2%), but avoid noisy trailing .0.
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
};

const matchesSensorKind = (entity: HaEntityState | undefined, kind: SensorKind): boolean => {
  if (!entity) return false;

  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const deviceClass = typeof attrs?.device_class === 'string' ? attrs.device_class : '';
  const unit = readUnit(entity);

  if (kind === 'humidity') {
    return deviceClass === 'humidity' || unit === '%';
  }

  return deviceClass === 'temperature' || unit.includes('°');
};

const normalizeRoomId = (roomId: string): string => {
  return roomId
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

const findFirstMatchingEntityFromIndex = (
  entityIdsByKind: Record<string, true> | undefined,
  entitiesById: Record<string, HaEntityState>,
  kind: SensorKind
): HaEntityState | undefined => {
  if (!entityIdsByKind) return undefined;

  const ids = Object.keys(entityIdsByKind).sort();
  for (const id of ids) {
    const entity = entitiesById[id];
    if (!entity) continue;
    if (!matchesSensorKind(entity, kind)) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }

  return undefined;
};

const findFirstMatchingCandidate = (
  candidates: string[],
  entitiesById: Record<string, HaEntityState>
): HaEntityState | undefined => {
  for (const id of candidates) {
    const entity = entitiesById[id];
    if (!entity) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }
  return undefined;
};

export function ClimatePanel({ isHidden = false }: { isHidden?: boolean }) {
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const householdEntityIdsByAreaId = useHouseholdAreaEntityIndexStore(
    (s) => s.householdEntityIdsByAreaId
  );
  const areaNameById = useHouseholdAreaEntityIndexStore((s) => s.areaNameById);

  const mapping = useMemo(() => getAreaClimateEntityMappingFromEnv(), []);

  const { unit, measuredTemp, measuredHumidity, minTemp, maxTemp } = useMemo(() => {
    // Prefer the precomputed household summary sensors when available.
    const meanEntity = entitiesById['sensor.household_temperature_mean_weighted'];
    const minEntity = entitiesById['sensor.household_temperature_minimum'];
    const maxEntity = entitiesById['sensor.household_temperature_maximum'];
    const humidityEntity = entitiesById['sensor.household_humidity_weighted_mean'];

    const mean = readNumber(meanEntity);
    const min = readNumber(minEntity);
    const max = readNumber(maxEntity);
    const householdHumidity = readPercentNumber(humidityEntity);

    const unitCandidate = readUnit(meanEntity ?? minEntity ?? maxEntity);

    // Humidity is available as a household summary sensor in some setups.
    // Keep the existing best-effort aggregation from the area index as a
    // fallback.
    const hums: number[] = [];
    for (const byKind of Object.values(householdEntityIdsByAreaId)) {
      for (const id of Object.keys(byKind.humidity ?? {})) {
        const entity = entitiesById[id];
        const v = readPercentNumber(entity);
        if (typeof v === 'number') {
          hums.push(v);
        }
      }
    }

    const avg = (values: number[]): number | undefined => {
      if (values.length === 0) return undefined;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    // If none of the household temperature summaries exist yet, fall back to a
    // best-effort aggregation using the existing per-room candidate logic.
    if (typeof mean !== 'number' && typeof min !== 'number' && typeof max !== 'number') {
      const temps: number[] = [];
      let fallbackUnit: string | undefined;

      // Use the area index and area names to find a representative temperature
      // sensor per area/room.
      for (const [areaId, byKind] of Object.entries(householdEntityIdsByAreaId)) {
        const areaName = areaNameById[areaId] ?? '';
        const roomId = normalizeRoomId(areaName || areaId);

        const configured = mapping[roomId];
        const tempCandidates = configured?.temperature
          ? [configured.temperature]
          : DEFAULT_AREA_TEMP_ENTITY_CANDIDATES(roomId);

        const tempEntity = findFirstMatchingCandidate(tempCandidates, entitiesById);
        const tempEntityFromIndex =
          !tempEntity && byKind
            ? findFirstMatchingEntityFromIndex(byKind.temperature, entitiesById, 'temperature')
            : undefined;

        const resolvedTempEntity = tempEntity ?? tempEntityFromIndex;
        const t = readNumber(resolvedTempEntity);
        if (typeof t === 'number') {
          temps.push(t);
          if (!fallbackUnit) fallbackUnit = readUnit(resolvedTempEntity);
        }
      }

      const nextUnit = fallbackUnit ?? unitCandidate;
      const nextMeasuredTemp = avg(temps);
      const nextMinTemp = temps.length ? Math.min(...temps) : undefined;
      const nextMaxTemp = temps.length ? Math.max(...temps) : undefined;

      return {
        unit: nextUnit,
        measuredTemp: nextMeasuredTemp,
        measuredHumidity: typeof householdHumidity === 'number' ? householdHumidity : avg(hums),
        minTemp: nextMinTemp,
        maxTemp: nextMaxTemp,
      };
    }

    return {
      unit: unitCandidate,
      measuredTemp: mean,
      measuredHumidity: typeof householdHumidity === 'number' ? householdHumidity : avg(hums),
      minTemp: min,
      maxTemp: max,
    };
  }, [areaNameById, entitiesById, householdEntityIdsByAreaId, mapping]);

  const modeLabel = '—';

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
              {typeof measuredHumidity === 'number' ? formatPercent(measuredHumidity) : '—'}
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
