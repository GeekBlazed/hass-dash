import { describe, expect, it } from 'vitest';

import {
  computeKonvaStageScalePxPerUnit,
  panStageViewByPixels,
  zoomStageViewAroundPointer,
} from './konvaStageMath';

describe('konvaStageMath', () => {
  it('computes stage scale (px/unit) from base width, viewport width, and scale', () => {
    const pxPerUnit = computeKonvaStageScalePxPerUnit({ w: 10 }, { width: 100 }, 1);
    expect(pxPerUnit).toBe(10);

    const pxPerUnit2 = computeKonvaStageScalePxPerUnit({ w: 10 }, { width: 100 }, 2);
    expect(pxPerUnit2).toBe(20);
  });

  it('pans stage view by pixel deltas (content follows drag)', () => {
    const start = { x: 0, y: 0, scale: 1 };
    // pxPerUnit = 10 so dxPx=10 => dxWorld=1
    const next = panStageViewByPixels({ w: 10 }, { width: 100 }, start, 10, 20);
    expect(next).toEqual({ x: -1, y: -2, scale: 1 });
  });

  it('zooms around pointer (keeps focal world point stable)', () => {
    const start = { x: 0, y: 0, scale: 1 };

    // base.w=10, viewport=100 => prevStageScale=10 px/unit
    // pointer at 50px => focalWorldX=5
    // nextScale=2 => nextStageScale=20 px/unit
    // nextX = 5 - 50/20 = 2.5
    const next = zoomStageViewAroundPointer({ w: 10 }, { width: 100 }, start, { x: 50, y: 50 }, 2);

    expect(next.scale).toBe(2);
    expect(next.x).toBeCloseTo(2.5, 8);
    expect(next.y).toBeCloseTo(2.5, 8);
  });
});
