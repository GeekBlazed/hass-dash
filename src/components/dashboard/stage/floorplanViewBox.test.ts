import { describe, expect, it } from 'vitest';

import {
  clampScale,
  computeBaseViewBoxFromFloor,
  flipYFromBaseViewBox,
  viewBoxToString,
} from './floorplanViewBox';

describe('floorplanViewBox', () => {
  describe('clampScale', () => {
    it('returns 1 for non-finite values', () => {
      expect(clampScale(Number.NaN)).toBe(1);
      expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
      expect(clampScale(Number.NEGATIVE_INFINITY)).toBe(1);
    });

    it('clamps to min/max bounds', () => {
      expect(clampScale(0.01)).toBe(0.5);
      expect(clampScale(999)).toBe(3);
      expect(clampScale(2)).toBe(2);
    });
  });

  describe('computeBaseViewBoxFromFloor', () => {
    it('uses explicit floor bounds when provided (with padding)', () => {
      const vb = computeBaseViewBoxFromFloor({
        rooms: [],
        bounds: { minX: 0, minY: 0, maxX: 10, maxY: 20 },
      });

      // Pad is applied in all directions.
      expect(vb.x).toBeCloseTo(-1.25);
      expect(vb.y).toBeCloseTo(-1.25);
      expect(vb.w).toBeCloseTo(12.5);
      expect(vb.h).toBeCloseTo(22.5);
    });

    it('falls back to room bounds when floor bounds are missing', () => {
      const vb = computeBaseViewBoxFromFloor({
        rooms: [
          {
            points: [
              [1, 2],
              [3, 4],
              [2, 6],
            ],
          },
        ],
      });

      // Raw bounds are (minX=1, minY=2) -> (maxX=3, maxY=6) => w=2, h=4.
      expect(vb.x).toBeCloseTo(1 - 1.25);
      expect(vb.y).toBeCloseTo(2 - 1.25);
      expect(vb.w).toBeCloseTo(2 + 2.5);
      expect(vb.h).toBeCloseTo(4 + 2.5);
    });

    it('returns a safe default when room bounds cannot be computed', () => {
      const vb = computeBaseViewBoxFromFloor({
        rooms: [
          {
            // Non-finite values should be ignored, forcing the fallback default.
            points: [
              [Number.NaN, 0],
              [1, Number.POSITIVE_INFINITY],
              [Number.NEGATIVE_INFINITY, 2],
            ],
          },
        ],
      });

      // Default is 0 0 10 10, then padding.
      expect(vb.x).toBeCloseTo(-1.25);
      expect(vb.y).toBeCloseTo(-1.25);
      expect(vb.w).toBeCloseTo(12.5);
      expect(vb.h).toBeCloseTo(12.5);
    });
  });

  it('formats viewBox strings', () => {
    expect(viewBoxToString({ x: 1, y: 2, w: 3, h: 4 })).toBe('1 2 3 4');
  });

  it('flips Y coordinates using the base viewBox', () => {
    const base = { x: -1.25, y: -1.25, w: 12.5, h: 12.5 };
    const flipY = flipYFromBaseViewBox(base);

    // For base y=-1.25 and h=12.5, flip is: 2*y + h - yInput = 10 - yInput
    expect(flipY(0)).toBeCloseTo(10);
    expect(flipY(10)).toBeCloseTo(0);
    expect(flipY(2)).toBeCloseTo(8);
  });
});
