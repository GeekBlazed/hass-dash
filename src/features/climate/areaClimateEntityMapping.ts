import type { HaEntityId } from '../../types/home-assistant';

export type AreaClimateEntityMapping = Record<
  string,
  {
    temperature?: HaEntityId;
    humidity?: HaEntityId;
  }
>;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const DEFAULT_AREA_TEMP_ENTITY_CANDIDATES = (areaId: string): HaEntityId[] => {
  const variants = getAreaIdVariants(areaId);
  return unique([
    ...variants.map((id) => `sensor.${id}_temperature` as HaEntityId),
    ...variants.map((id) => `sensor.${id}_temp` as HaEntityId),
    ...variants.map((id) => `sensor.${id}_air_temperature` as HaEntityId),
  ]);
};

export const DEFAULT_AREA_HUMIDITY_ENTITY_CANDIDATES = (areaId: string): HaEntityId[] => {
  const variants = getAreaIdVariants(areaId);
  return unique([
    ...variants.map((id) => `sensor.${id}_humidity` as HaEntityId),
    ...variants.map((id) => `sensor.${id}_relative_humidity` as HaEntityId),
    ...variants.map((id) => `sensor.${id}_humidity_relative` as HaEntityId),
  ]);
};

const normalizeAreaIdForEntityObjectId = (areaId: string): string => {
  // Home Assistant entity object_ids commonly use underscores.
  // Floorplan room ids are often kebab-cased (e.g. living-room).
  return areaId.trim().replace(/[\s-]+/g, '_');
};

const getAreaIdVariants = (areaId: string): string[] => {
  const raw = areaId.trim();
  const normalized = normalizeAreaIdForEntityObjectId(raw);
  const rawLower = raw.toLowerCase();
  const normalizedLower = normalized.toLowerCase();

  return unique([raw, normalized, rawLower, normalizedLower]);
};

const unique = <T>(values: T[]): T[] => {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    result.push(v);
  }
  return result;
};

export function parseAreaClimateEntityMapping(raw: unknown): AreaClimateEntityMapping {
  const value = asNonEmptyString(raw);
  if (!value) return {};

  try {
    const parsedUnknown: unknown = JSON.parse(value);
    const parsed = asRecord(parsedUnknown);
    if (!parsed) return {};

    const result: AreaClimateEntityMapping = {};
    for (const [areaIdRaw, entryRaw] of Object.entries(parsed)) {
      const areaId = asNonEmptyString(areaIdRaw);
      if (!areaId) continue;

      const entry = asRecord(entryRaw);
      if (!entry) continue;

      const temperature = asNonEmptyString(entry.temperature);
      const humidity = asNonEmptyString(entry.humidity);

      if (!temperature && !humidity) continue;

      result[areaId] = {
        temperature: temperature as HaEntityId | undefined,
        humidity: humidity as HaEntityId | undefined,
      };
    }

    return result;
  } catch {
    return {};
  }
}

export function getAreaClimateEntityMappingFromEnv(
  env: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>
): AreaClimateEntityMapping {
  return parseAreaClimateEntityMapping(env.VITE_HA_AREA_CLIMATE_ENTITY_MAP);
}
