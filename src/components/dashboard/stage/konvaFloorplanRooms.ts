import type { FloorplanPoint2D } from '../../../features/model/floorplan';

export type Point2D = [number, number];

export const centroid = (points: Point2D[]): Point2D => {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
};

export const flattenPoints = (points: Point2D[]): number[] => {
  const out: number[] = [];
  for (const [x, y] of points) {
    out.push(x, y);
  }
  return out;
};

export const flipPointsY = (
  points: FloorplanPoint2D[],
  flipY: (y: number) => number
): Point2D[] => {
  return points.map(([x, y]) => [x, flipY(y)] as Point2D);
};
