import type { HaEntityState } from '../../../types/home-assistant';

export interface DeviceLocationUpdate {
  entityId: string;
  position: { x: number; y: number; z?: number };
  geo?: { latitude: number; longitude: number; elevation?: number };
  confidence: number;
  lastSeen?: string;
  receivedAt: number;
}

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;

    // Prefer strict numeric parsing.
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;

    // Fall back to parseFloat to tolerate values with suffixes like "40.12 m".
    const floatParsed = Number.parseFloat(trimmed);
    if (Number.isFinite(floatParsed)) return floatParsed;
  }
  return undefined;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

type Geo = { latitude: number; longitude: number; elevation?: number };

const getGeoFromRecord = (record: Record<string, unknown>): Geo | undefined => {
  const latitude = getNumber(record.latitude ?? record.lat);
  const longitude = getNumber(record.longitude ?? record.lon ?? record.lng ?? record.long);
  const elevation = getNumber(
    record.elevation ?? record.ele ?? record.alt ?? record.altitude ?? record.height
  );

  if (latitude === undefined || longitude === undefined) return undefined;

  return {
    latitude,
    longitude,
    ...(elevation === undefined ? {} : { elevation }),
  };
};

const getGeoFromAttributes = (attributes: Record<string, unknown>): Geo | undefined => {
  // Direct fields are the canonical expected shape.
  const direct = getGeoFromRecord(attributes);
  if (direct) return direct;

  // Some integrations nest under an object.
  for (const key of ['gps', 'geo', 'location', 'coords', 'coordinates']) {
    const nested = attributes[key];
    if (!isRecord(nested)) continue;
    const candidate = getGeoFromRecord(nested);
    if (candidate) return candidate;
  }

  return undefined;
};

/**
 * Extracts a single location update from a Home Assistant entity state.
 *
 * Intended for ESPresense-companion-backed `device_tracker.*` entities where
 * location is stored in entity attributes: `x`, `y`, optional `z`, `confidence`, `last_seen`.
 */
export const extractDeviceLocationUpdateFromHaEntityState = (
  entityState: HaEntityState,
  minConfidence: number,
  receivedAt: number = Date.now()
): DeviceLocationUpdate[] => {
  const attributes = entityState.attributes;
  if (!isRecord(attributes)) return [];

  const x = getNumber(attributes.x);
  const y = getNumber(attributes.y);
  const z = getNumber(attributes.z);
  const confidence = getNumber(attributes.confidence);

  if (x === undefined || y === undefined || confidence === undefined) return [];
  if (!(confidence > minConfidence)) return [];

  const lastSeen = getString(attributes.last_seen);

  const geo = getGeoFromAttributes(attributes);

  return [
    {
      entityId: entityState.entity_id,
      position: z === undefined ? { x, y } : { x, y, z },
      geo,
      confidence,
      lastSeen,
      receivedAt,
    },
  ];
};

/**
 * Extracts location updates from a JSON payload.
 *
 * Supports the "HA WebSocket event envelope" style example documented in
 * `docs/FEATURE-DEVICE-TRACKING-ESPRESENSE.md`:
 *
 * - `event.c` is a dictionary keyed by entityId.
 * - Each entry contains a `"+"` object with an `a` attributes object.
 */
export const extractDeviceLocationUpdatesFromJsonPayload = (
  payload: string,
  minConfidence: number,
  receivedAt: number = Date.now()
): DeviceLocationUpdate[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }

  if (!isRecord(parsed)) return [];
  const event = isRecord(parsed.event) ? parsed.event : undefined;
  const c = event && isRecord(event.c) ? event.c : undefined;
  if (!c) return [];

  const updates: DeviceLocationUpdate[] = [];

  for (const [entityId, rawEntry] of Object.entries(c)) {
    if (!isRecord(rawEntry)) continue;
    const plus = isRecord(rawEntry['+']) ? rawEntry['+'] : undefined;
    const a = plus && isRecord(plus.a) ? plus.a : undefined;
    if (!a) continue;

    const x = getNumber(a.x);
    const y = getNumber(a.y);
    const z = getNumber(a.z);
    const confidence = getNumber(a.confidence);

    if (x === undefined || y === undefined || confidence === undefined) continue;
    if (!(confidence > minConfidence)) continue;

    const lastSeen = getString(a.last_seen);

    const geo = getGeoFromAttributes(a);

    updates.push({
      entityId,
      position: z === undefined ? { x, y } : { x, y, z },
      geo,
      confidence,
      lastSeen,
      receivedAt,
    });
  }

  return updates;
};
