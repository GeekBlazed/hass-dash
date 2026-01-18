import { describe, expect, it } from 'vitest';
import { centroid, flattenPoints, flipPointsY } from './konvaFloorplanRooms';

describe('konvaFloorplanRooms', () => {
  it('flattenPoints flattens x/y pairs in order', () => {
    expect(
      flattenPoints([
        [1, 2],
        [3, 4],
      ])
    ).toEqual([1, 2, 3, 4]);
  });

  it('centroid averages x/y', () => {
    expect(
      centroid([
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
      ])
    ).toEqual([1, 1]);
  });

  it('flipPointsY flips y via provided function', () => {
    const flipped = flipPointsY(
      [
        [1, 10],
        [2, 20],
      ],
      (y) => 100 - y
    );

    expect(flipped).toEqual([
      [1, 90],
      [2, 80],
    ]);
  });
});
