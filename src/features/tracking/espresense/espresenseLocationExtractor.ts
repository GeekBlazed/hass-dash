import type { HaEntityState } from '../../../types/home-assistant';

export interface DeviceLocationUpdate {
  entityId: string;
  position: { x: number; y: number; z?: number };
  confidence: number;
  lastSeen?: string;
  receivedAt: number;
}

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const getString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
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

  return [
    {
      entityId: entityState.entity_id,
      position: z === undefined ? { x, y } : { x, y, z },
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

    updates.push({
      entityId,
      position: z === undefined ? { x, y } : { x, y, z },
      confidence,
      lastSeen,
      receivedAt,
    });
  }

  return updates;
};
