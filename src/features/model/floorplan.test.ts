import { describe, expect, it } from 'vitest';

import { getDefaultFloor, normalizeFloorplan } from './floorplan';

describe('floorplan model', () => {
  describe('normalizeFloorplan', () => {
    it('returns an empty model for non-record input', () => {
      expect(normalizeFloorplan(null)).toEqual({ defaultFloorId: 'ground', floors: [] });
      expect(normalizeFloorplan('nope')).toEqual({ defaultFloorId: 'ground', floors: [] });
    });

    it('normalizes a valid document (floors, rooms, gps)', () => {
      const model = normalizeFloorplan({
        default_floor_id: 'upstairs',
        gps: { latitude: 1, longitude: 2, elevation: 3 },
        floors: [
          {
            id: 'upstairs',
            name: 'Upstairs',
            rooms: [
              {
                id: 'bedroom',
                name: 'Bedroom',
                points: [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                ],
              },
            ],
          },
        ],
      });

      expect(model.defaultFloorId).toBe('upstairs');
      expect(model.gps).toEqual({ latitude: 1, longitude: 2, elevation: 3 });
      expect(model.floors).toHaveLength(1);
      expect(model.floors[0]?.rooms).toHaveLength(1);
      expect(model.floors[0]?.rooms[0]?.points).toHaveLength(3);
    });

    it('is forgiving: drops invalid floors/rooms/points and defaults gps values', () => {
      const model = normalizeFloorplan({
        default_floor_id: 123,
        gps: { latitude: 'x', longitude: null, elevation: NaN },
        floors: [
          'not-a-floor',
          { id: 'missing-name' },
          {
            id: 'ground',
            name: 'Ground',
            rooms: [
              { id: 'missing-points', name: 'Room' },
              {
                id: 'too-few-points',
                name: 'Bad Room',
                points: [
                  [0, 0],
                  [1, 1],
                ],
              },
              {
                id: 'mixed-points',
                name: 'Good Room',
                points: [
                  [0, 0],
                  ['x', 0],
                  [10, 0],
                  [10, 10],
                ],
              },
            ],
          },
        ],
      });

      // default_floor_id invalid => default
      expect(model.defaultFloorId).toBe('ground');

      // gps present but invalid numbers => coerced to 0
      expect(model.gps).toEqual({ latitude: 0, longitude: 0, elevation: 0 });

      // only one valid floor remains
      expect(model.floors).toHaveLength(1);
      expect(model.floors[0]?.id).toBe('ground');

      // only "mixed-points" room survives, and invalid point is dropped
      expect(model.floors[0]?.rooms).toHaveLength(1);
      expect(model.floors[0]?.rooms[0]?.id).toBe('mixed-points');
      expect(model.floors[0]?.rooms[0]?.points).toEqual([
        [0, 0],
        [10, 0],
        [10, 10],
      ]);
    });
  });

  describe('getDefaultFloor', () => {
    it('returns the floor matching defaultFloorId when present', () => {
      const model = normalizeFloorplan({
        default_floor_id: 'ground',
        floors: [
          { id: 'basement', name: 'Basement', rooms: [] },
          { id: 'ground', name: 'Ground', rooms: [] },
        ],
      });

      expect(getDefaultFloor(model)?.id).toBe('ground');
    });

    it('falls back to the first floor when defaultFloorId is missing', () => {
      const model = normalizeFloorplan({
        default_floor_id: 'missing',
        floors: [{ id: 'ground', name: 'Ground', rooms: [] }],
      });

      expect(getDefaultFloor(model)?.id).toBe('ground');
    });

    it('returns undefined when there are no floors', () => {
      const model = normalizeFloorplan({ default_floor_id: 'ground', floors: [] });
      expect(getDefaultFloor(model)).toBeUndefined();
    });
  });
});
