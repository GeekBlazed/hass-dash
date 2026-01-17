export type FloorplanPoint2D = [number, number];
export type FloorplanPoint3D = [number, number, number];

export interface FloorplanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FloorplanInitialView {
  scale: number;
  x: number;
  y: number;
}

export interface FloorplanNode {
  id: string;
  name: string;
  point: FloorplanPoint3D;
  // Optional metadata from YAML (not used for rendering yet)
  floor?: string;
  room?: string;
}

export interface FloorplanRoom {
  id: string;
  name: string;
  points: FloorplanPoint2D[];
}

export interface FloorplanFloor {
  id: string;
  name: string;
  rooms: FloorplanRoom[];
  bounds?: FloorplanBounds;
  initialView?: FloorplanInitialView;
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
  nodes?: FloorplanNode[];
}

interface RawFloorplanDoc {
  default_floor_id?: unknown;
  gps?: unknown;
  floors?: unknown;
  nodes?: unknown;
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

const asPoint3D = (value: unknown): FloorplanPoint3D | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const x = asNumber(value[0]);
  const y = asNumber(value[1]);
  const z = value.length >= 3 ? asNumber(value[2]) : 0;
  if (x === undefined || y === undefined) return undefined;
  return [x, y, z ?? 0];
};

const asBounds = (value: unknown): FloorplanBounds | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const a = value[0];
  const b = value[1];
  if (!Array.isArray(a) || !Array.isArray(b)) return undefined;
  const minX = asNumber(a[0]);
  const minY = asNumber(a[1]);
  const maxX = asNumber(b[0]);
  const maxY = asNumber(b[1]);
  if ([minX, minY, maxX, maxY].some((n) => n === undefined)) return undefined;
  return { minX: minX ?? 0, minY: minY ?? 0, maxX: maxX ?? 0, maxY: maxY ?? 0 };
};

const asInitialView = (floor: Record<string, unknown>): FloorplanInitialView | undefined => {
  const scale = asNumber(floor.initial_scale);
  const x = asNumber(floor.initial_x);
  const y = asNumber(floor.initial_y);
  if (scale === undefined && x === undefined && y === undefined) return undefined;
  return {
    scale: scale ?? 1,
    x: x ?? 0,
    y: y ?? 0,
  };
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

    const bounds = asBounds(floor.bounds);
    const initialView = asInitialView(floor);

    floors.push({ id, name, rooms, bounds, initialView });
  }

  const nodesRaw = Array.isArray(raw.nodes) ? raw.nodes : [];
  const nodes: FloorplanNode[] = [];

  for (const node of nodesRaw) {
    if (!isRecord(node)) continue;
    const id = asString(node.id) ?? asString(node.name);
    const name = asString(node.name) ?? asString(node.id);
    if (!id || !name) continue;

    const pointCandidate = Array.isArray(node.point)
      ? node.point
      : Array.isArray(node.points)
        ? node.points
        : null;
    const point = asPoint3D(pointCandidate);
    if (!point) continue;

    const floor = asString(node.floor);
    const room = asString(node.room);
    nodes.push({ id: id.trim(), name: name.trim(), point, floor, room });
  }

  return { defaultFloorId, gps, floors, nodes: nodes.length ? nodes : undefined };
}

export function getDefaultFloor(model: FloorplanModel): FloorplanFloor | undefined {
  return model.floors.find((f) => f.id === model.defaultFloorId) ?? model.floors[0];
}
