export type Point2D = readonly [number, number];

/**
 * Returns true when `point` lies inside `polygon`.
 *
 * Uses a ray-casting algorithm. Points on the boundary are treated as inside.
 */
export function pointInPolygon(point: Point2D, polygon: ReadonlyArray<Point2D>): boolean {
  if (polygon.length < 3) return false;

  const [x, y] = point;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Boundary check (colinear + within segment bounds).
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12) {
      const dot = (x - xi) * (xj - xi) + (y - yi) * (yj - yi);
      if (dot >= 0) {
        const lenSq = (xj - xi) * (xj - xi) + (yj - yi) * (yj - yi);
        if (dot <= lenSq) return true;
      }
    }

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}
