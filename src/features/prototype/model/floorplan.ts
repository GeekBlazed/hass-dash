export type FloorplanPoint2D = [number, number];

export interface FloorplanRoom {
  id: string;
  name: string;
  points: FloorplanPoint2D[];
}

export interface FloorplanFloor {
  id: string;
  name: string;
  rooms: FloorplanRoom[];
}

export interface FloorplanGps {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface FloorplanModel {
  defaultFloorId: string;
  gps?: FloorplanGps;
  floors: FloorplanFloor[];
}

interface RawFloorplanDoc {
  default_floor_id?: unknown;
  gps?: unknown;
  floors?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const asPoint2D = (value: unknown): FloorplanPoint2D | undefined => {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const x = asNumber(value[0]);
  const y = asNumber(value[1]);
  if (x === undefined || y === undefined) return undefined;
  return [x, y];
};

/**
 * Normalize the floorplan YAML document into a stable model.
 *
 * This is intentionally forgiving: missing/invalid content yields an empty model.
 */
export function normalizeFloorplan(doc: unknown): FloorplanModel {
  if (!isRecord(doc)) return { defaultFloorId: 'ground', floors: [] };

  const raw = doc as RawFloorplanDoc;

  const defaultFloorId = asString(raw.default_floor_id) ?? 'ground';

  const gps = isRecord(raw.gps)
    ? {
        latitude: asNumber(raw.gps.latitude) ?? 0,
        longitude: asNumber(raw.gps.longitude) ?? 0,
        elevation: asNumber(raw.gps.elevation) ?? 0,
      }
    : undefined;

  const floorsRaw = Array.isArray(raw.floors) ? raw.floors : [];
  const floors: FloorplanFloor[] = [];

  for (const floor of floorsRaw) {
    if (!isRecord(floor)) continue;

    const id = asString(floor.id);
    const name = asString(floor.name);
    if (!id || !name) continue;

    const roomsRaw = Array.isArray(floor.rooms) ? floor.rooms : [];
    const rooms: FloorplanRoom[] = [];

    for (const room of roomsRaw) {
      if (!isRecord(room)) continue;

      const roomId = asString(room.id);
      const roomName = asString(room.name);
      const pointsRaw = Array.isArray(room.points) ? room.points : [];

      if (!roomId || !roomName) continue;

      const points: FloorplanPoint2D[] = [];
      for (const p of pointsRaw) {
        const point = asPoint2D(p);
        if (point) points.push(point);
      }

      if (points.length < 3) continue;

      rooms.push({ id: roomId, name: roomName, points });
    }

    floors.push({ id, name, rooms });
  }

  return { defaultFloorId, gps, floors };
}

export function getDefaultFloor(model: FloorplanModel): FloorplanFloor | undefined {
  return model.floors.find((f) => f.id === model.defaultFloorId) ?? model.floors[0];
}
