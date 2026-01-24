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

  const { temperatureText, humidityText } = useMemo(() => {
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
    };
  }, [entitiesById, weatherEntityIds]);

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

  return (
    <div className="weather" aria-label="Weather summary">
      {iconName ? (
        <Icon icon={iconName} aria-hidden="true" data-testid="weather-icon" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M6 14.5a4.5 4.5 0 0 1 4.43-4.5A5.5 5.5 0 0 1 21 12.5a4.5 4.5 0 0 1-4.5 4.5H7.5A3.5 3.5 0 0 1 6 14.5zm4.5 4.5h2l-1 3h-2l1-3zm4 0h2l-1 3h-2l1-3z"
          />
        </svg>
      )}
      <div>
        <div className="temp">{temperatureText}</div>
        <div className="desc">{descriptionText}</div>
        <div className="meta">Humidity: {humidityText}</div>
      </div>
    </div>
  );
}
