import { useEffect, useMemo, useState } from 'react';

import { Icon } from '@iconify/react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { IEntityLabelService } from '../../../interfaces/IEntityLabelService';
import { useEntityStore } from '../../../stores/useEntityStore';
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

const readWeatherLabel = (entity: HaEntityState | undefined): string => {
  if (!entity) return '';
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const labelCandidate =
    typeof attrs?.label === 'string'
      ? attrs.label
      : typeof attrs?.friendly_name === 'string'
        ? attrs.friendly_name
        : '';
  return labelCandidate.trim();
};

const matchesWeatherSensor = (entity: HaEntityState | undefined, kind: SensorKind): boolean => {
  if (!entity) return false;

  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const deviceClass = typeof attrs?.device_class === 'string' ? attrs.device_class : '';
  if (deviceClass !== kind) return false;

  // The user-provided identifier for local weather sensors.
  // In Home Assistant this may map to an entity registry label (preferred) or friendly_name.
  return readWeatherLabel(entity).toLowerCase() === 'weather';
};

const findFirstMatchingFromEntityIds = (
  entitiesById: Record<string, HaEntityState>,
  entityIds: Iterable<string>,
  kind: SensorKind
): HaEntityState | undefined => {
  for (const entityId of entityIds) {
    const entity = entitiesById[entityId];
    if (!entity) continue;

    const attrs = entity.attributes as Record<string, unknown> | undefined;
    const deviceClass = typeof attrs?.device_class === 'string' ? attrs.device_class : '';
    if (deviceClass !== kind) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }
  return undefined;
};

const findFirstMatching = (
  entitiesById: Record<string, HaEntityState>,
  kind: SensorKind
): HaEntityState | undefined => {
  for (const entity of Object.values(entitiesById)) {
    if (!matchesWeatherSensor(entity, kind)) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }
  return undefined;
};

const formatTemperature = (value: number | undefined, unit: string): string => {
  if (typeof value !== 'number') return `--${unit}`;
  const rounded = Math.round(value);
  return `${rounded}${unit}`;
};

const formatHumidity = (value: number | undefined): string => {
  if (typeof value !== 'number') return '--%';
  // Keep one decimal when present, but avoid noisy trailing .0.
  return `${value.toFixed(1).replace(/\.0$/, '')}%`;
};

const formatWeatherDescription = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const withCommas = trimmed.replace(/-/g, ', ');

  let out = '';
  let newWord = true;
  for (const ch of withCommas) {
    const isAlphaNumeric = /[0-9A-Za-z]/.test(ch);
    if (!isAlphaNumeric) {
      out += ch;
      newWord = true;
      continue;
    }

    if (newWord) {
      out += ch.toUpperCase();
      newWord = false;
    } else {
      out += ch;
    }
  }

  return out;
};

const readHaIconName = (entity: HaEntityState | undefined): string => {
  const attrs = entity?.attributes as Record<string, unknown> | undefined;
  const icon = attrs?.icon;
  if (typeof icon !== 'string') return '';
  const trimmed = icon.trim();
  // Expect values like "mdi:weather-partly-cloudy".
  return trimmed.includes(':') ? trimmed : '';
};

const weatherStateToMdiIcon = (state: string): string => {
  const trimmed = state.trim().toLowerCase();
  if (!trimmed) return '';

  // Home Assistant weather condition states:
  // https://www.home-assistant.io/integrations/weather/#condition-mapping
  // Some icon names don't match the raw state 1:1.
  if (trimmed === 'clear-night') return 'mdi:weather-night';
  if (trimmed === 'partlycloudy') return 'mdi:weather-partly-cloudy';

  // Most map cleanly to `mdi:weather-${state}`.
  // Accept only safe characters to avoid rendering arbitrary icon names.
  if (!/^[a-z0-9_-]+$/.test(trimmed)) return '';
  const normalized = trimmed.replace(/_/g, '-');
  return `mdi:weather-${normalized}`;
};

export function WeatherSummary() {
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const lastUpdatedAt = useEntityStore((s) => s.lastUpdatedAt);
  const entityLabelService = useService<IEntityLabelService>(TYPES.IEntityLabelService);
  const [weatherEntityIds, setWeatherEntityIds] = useState<ReadonlySet<string> | null>(null);
  const [weatherDescriptionEntityIds, setWeatherDescriptionEntityIds] =
    useState<ReadonlySet<string> | null>(null);
  const [weatherDetailsEntityIds, setWeatherDetailsEntityIds] =
    useState<ReadonlySet<string> | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // If we already resolved the label ids (including an empty set), don't refetch.
    if (weatherEntityIds !== null) return;

    let isCancelled = false;

    const run = async () => {
      try {
        const ids = await entityLabelService.getEntityIdsByLabelName('Weather');
        if (isCancelled) return;
        setWeatherEntityIds(ids);
      } catch {
        if (isCancelled) return;
        // Keep as null so we can retry later once HA is connected.
        setWeatherEntityIds(null);
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
    // When the entity store starts receiving updates, HA is very likely connected,
    // so this is a good time to retry label resolution.
  }, [entityLabelService, lastUpdatedAt, weatherEntityIds]);

  useEffect(() => {
    // If we already resolved the label ids (including an empty set), don't refetch.
    if (weatherDescriptionEntityIds !== null) return;

    let isCancelled = false;

    const run = async () => {
      try {
        const [hassDashIds, descriptionIds] = await Promise.all([
          entityLabelService.getEntityIdsByLabelName('hass-dash'),
          entityLabelService.getEntityIdsByLabelName('Weather Description'),
        ]);

        if (isCancelled) return;

        const intersection = new Set<string>();
        for (const id of hassDashIds) {
          if (descriptionIds.has(id)) {
            intersection.add(id);
          }
        }

        setWeatherDescriptionEntityIds(intersection);
      } catch {
        if (isCancelled) return;
        // Keep as null so we can retry later once HA is connected.
        setWeatherDescriptionEntityIds(null);
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
    // When the entity store starts receiving updates, HA is very likely connected,
    // so this is a good time to retry label resolution.
  }, [entityLabelService, lastUpdatedAt, weatherDescriptionEntityIds]);

  useEffect(() => {
    // If we already resolved the label ids (including an empty set), don't refetch.
    if (weatherDetailsEntityIds !== null) return;

    let isCancelled = false;

    const run = async () => {
      try {
        const [hassDashIds, weatherIds] = await Promise.all([
          entityLabelService.getEntityIdsByLabelName('hass-dash'),
          entityLabelService.getEntityIdsByLabelName('Weather'),
        ]);

        if (isCancelled) return;

        const intersection = new Set<string>();
        for (const id of hassDashIds) {
          if (weatherIds.has(id)) {
            intersection.add(id);
          }
        }

        setWeatherDetailsEntityIds(intersection);
      } catch {
        if (isCancelled) return;
        // Keep as null so we can retry later once HA is connected.
        setWeatherDetailsEntityIds(null);
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
    // When the entity store starts receiving updates, HA is very likely connected,
    // so this is a good time to retry label resolution.
  }, [entityLabelService, lastUpdatedAt, weatherDetailsEntityIds]);

  const { temperatureText, humidityText, temperatureEntityId, humidityEntityId } = useMemo(() => {
    const labeledIds = weatherEntityIds;

    const temperatureEntity =
      labeledIds && labeledIds.size > 0
        ? findFirstMatchingFromEntityIds(entitiesById, labeledIds, 'temperature')
        : findFirstMatching(entitiesById, 'temperature');

    const humidityEntity =
      labeledIds && labeledIds.size > 0
        ? findFirstMatchingFromEntityIds(entitiesById, labeledIds, 'humidity')
        : findFirstMatching(entitiesById, 'humidity');

    const temperature = readNumber(temperatureEntity);
    const unit = readUnit(temperatureEntity);

    const humidityRaw = readNumber(humidityEntity);
    const humidity =
      typeof humidityRaw === 'number' && humidityRaw >= 0 && humidityRaw <= 100
        ? humidityRaw
        : undefined;

    return {
      temperatureText: formatTemperature(temperature, unit),
      humidityText: formatHumidity(humidity),
      temperatureEntityId: temperatureEntity?.entity_id ?? '',
      humidityEntityId: humidityEntity?.entity_id ?? '',
    };
  }, [entitiesById, weatherEntityIds]);

  const weatherDetails = useMemo(() => {
    const ids = weatherDetailsEntityIds;
    if (!ids || ids.size === 0) return [] as Array<{ id: string; label: string; value: string }>;

    const excluded = new Set<string>();
    if (temperatureEntityId) excluded.add(temperatureEntityId);
    if (humidityEntityId) excluded.add(humidityEntityId);
    for (const id of weatherDescriptionEntityIds ?? []) {
      excluded.add(id);
    }

    const readFriendlyName = (entity: HaEntityState | undefined): string => {
      const attrs = entity?.attributes as Record<string, unknown> | undefined;
      const name = attrs?.friendly_name;
      return typeof name === 'string' ? name.trim() : '';
    };

    const formatDerivedName = (entityId: string): string => {
      const [, objectId = entityId] = entityId.split('.', 2);
      const spaced = objectId.replace(/[_-]+/g, ' ').trim();
      if (!spaced) return entityId;
      return spaced.replace(/\b\w/g, (ch) => ch.toUpperCase());
    };

    const readUnitOptional = (entity: HaEntityState | undefined): string => {
      const attrs = entity?.attributes as Record<string, unknown> | undefined;
      const unit = attrs?.unit_of_measurement;
      return typeof unit === 'string' ? unit.trim() : '';
    };

    const formatGenericNumber = (value: number): string => {
      if (Number.isInteger(value)) return String(value);
      return value.toFixed(1).replace(/\.0$/, '');
    };

    const formatEntityState = (entity: HaEntityState | undefined): string => {
      if (!entity) return '—';

      const raw = typeof entity.state === 'string' ? entity.state.trim() : '';
      if (!raw || raw.toLowerCase() === 'unknown' || raw.toLowerCase() === 'unavailable') {
        return '—';
      }

      if (entity.entity_id.startsWith('weather.')) {
        const formatted = formatWeatherDescription(raw);
        return formatted || '—';
      }

      const unit = readUnitOptional(entity);
      const numeric = Number.parseFloat(raw);
      if (Number.isFinite(numeric)) {
        const n = formatGenericNumber(numeric);
        if (!unit) return n;
        if (unit === '%' || unit.includes('°')) return `${n}${unit}`;
        return `${n} ${unit}`;
      }

      return raw;
    };

    const rows: Array<{ id: string; label: string; value: string }> = [];
    for (const id of Array.from(ids).sort()) {
      if (excluded.has(id)) continue;

      const entity = entitiesById[id];
      if (!entity) continue;

      const friendly = readFriendlyName(entity);
      const label = friendly || formatDerivedName(id);
      const value = formatEntityState(entity);
      if (value === '—') continue;

      rows.push({ id, label, value });
    }

    rows.sort((a, b) => a.label.localeCompare(b.label));
    return rows;
  }, [
    entitiesById,
    humidityEntityId,
    temperatureEntityId,
    weatherDescriptionEntityIds,
    weatherDetailsEntityIds,
  ]);

  const descriptionText = useMemo(() => {
    const ids = weatherDescriptionEntityIds;
    if (!ids || ids.size === 0) return 'Weather';

    for (const entityId of ids) {
      const entity = entitiesById[entityId];
      const state = typeof entity?.state === 'string' ? entity.state.trim() : '';
      if (state) {
        const formatted = formatWeatherDescription(state);
        return formatted || 'Weather';
      }
    }

    return 'Weather';
  }, [entitiesById, weatherDescriptionEntityIds]);

  const iconName = useMemo(() => {
    const ids = weatherDescriptionEntityIds;
    if (!ids || ids.size === 0) return '';

    for (const entityId of ids) {
      const entity = entitiesById[entityId];
      const iconFromAttr = readHaIconName(entity);
      if (iconFromAttr) return iconFromAttr;

      const state = typeof entity?.state === 'string' ? entity.state : '';
      const iconFromState = weatherStateToMdiIcon(state);
      if (iconFromState) return iconFromState;
    }

    return '';
  }, [entitiesById, weatherDescriptionEntityIds]);

  const detailsId = 'weather-details';

  return (
    <div className="weather weather--accordion" aria-label="Weather summary">
      <button
        type="button"
        className="weather__header"
        aria-label="Toggle weather details"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {iconName ? (
          <Icon
            icon={iconName}
            aria-hidden="true"
            data-testid="weather-icon"
            className="weather-icon"
          />
        ) : (
          <Icon
            icon="mdi:weather-partly-cloudy"
            aria-hidden="true"
            data-testid="weather-icon"
            className="weather-icon"
          />
        )}
        <div>
          <div className="temp">
            {temperatureText}
            {' / '}
            <span className="humidity">
              <Icon
                icon="mdi:water-percent"
                aria-hidden="true"
                data-testid="humidity-icon"
                className="humidity-icon"
              />
              {humidityText}
            </span>
          </div>
          <div className="desc">{descriptionText}</div>
        </div>

        <Icon
          icon="mdi:chevron-down"
          aria-hidden="true"
          className={isExpanded ? 'weather__chevron weather__chevron--open' : 'weather__chevron'}
        />
      </button>

      <div
        id={detailsId}
        role="region"
        aria-label="Weather details"
        className="weather__details"
        hidden={!isExpanded}
      >
        {weatherDetails.length > 0 ? (
          <dl className="weather-details__grid">
            {weatherDetails.map((row) => (
              <div key={row.id} className="weather-details__item" data-entity-id={row.id}>
                <dt className="weather-details__label">{row.label}</dt>
                <dd className="weather-details__value">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="weather-details__empty" data-managed-by="react">
            No additional Weather sensors found.
          </div>
        )}
      </div>
    </div>
  );
}
