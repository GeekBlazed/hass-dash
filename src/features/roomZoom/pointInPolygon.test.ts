import { describe, expect, it } from 'vitest';

import { pointInPolygon } from './pointInPolygon';

describe('pointInPolygon', () => {
  it('returns true for points strictly inside', () => {
    const square: Array<[number, number]> = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];

    expect(pointInPolygon([1, 1], square)).toBe(true);
  });

  it('returns false for points outside', () => {
    const square: Array<[number, number]> = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];

    expect(pointInPolygon([3, 1], square)).toBe(false);
  });

  it('treats boundary points as inside', () => {
    const square: Array<[number, number]> = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];

    expect(pointInPolygon([0, 1], square)).toBe(true);
    expect(pointInPolygon([2, 1], square)).toBe(true);
    expect(pointInPolygon([1, 0], square)).toBe(true);
  });
});
