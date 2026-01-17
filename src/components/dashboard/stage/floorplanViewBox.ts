export type ViewBox = { x: number; y: number; w: number; h: number };

const PAD_UNITS = 1.25;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

export const clampScale = (scale: number): number => {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
};

const computeBoundsFromRooms = (rooms: Array<{ points: Array<[number, number]> }>): ViewBox => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const room of rooms) {
    for (const [x, y] of room.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n))) {
    return { x: 0, y: 0, w: 10, h: 10 };
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export const computeBaseViewBoxFromFloor = (floor: {
  rooms: Array<{ points: Array<[number, number]> }>;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
}): ViewBox => {
  const raw = floor.bounds
    ? {
        x: floor.bounds.minX,
        y: floor.bounds.minY,
        w: floor.bounds.maxX - floor.bounds.minX,
        h: floor.bounds.maxY - floor.bounds.minY,
      }
    : computeBoundsFromRooms(floor.rooms);

  return {
    x: raw.x - PAD_UNITS,
    y: raw.y - PAD_UNITS,
    w: raw.w + PAD_UNITS * 2,
    h: raw.h + PAD_UNITS * 2,
  };
};

export const viewBoxToString = (vb: ViewBox): string => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

export const flipYFromBaseViewBox = (baseViewBox: ViewBox) => {
  return (y: number) => 2 * baseViewBox.y + baseViewBox.h - y;
};
