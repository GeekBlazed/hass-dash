import { describe, expect, it, vi } from 'vitest';

import { loadFloorplanModelJson, parseFloorplanModelJson } from './floorplanJson';

describe('floorplanJson', () => {
  it('parses a valid FloorplanModel JSON document', () => {
    const model = parseFloorplanModelJson({
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground Floor',
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              points: [
                [0, 0],
                [1, 0],
                [1, 1],
              ],
            },
          ],
        },
      ],
    });

    expect(model.defaultFloorId).toBe('ground');
    expect(model.floors[0]?.rooms[0]?.id).toBe('kitchen');
  });

  it('throws a helpful error when JSON is invalid', () => {
    expect(() =>
      parseFloorplanModelJson({
        defaultFloorId: 'ground',
        floors: [
          {
            id: 'ground',
            name: 'Ground Floor',
            rooms: [
              {
                id: 'kitchen',
                name: 'Kitchen',
                points: [
                  [0, 0],
                  [1, 0],
                ],
              },
            ],
          },
        ],
      })
    ).toThrow(/invalid floorplan json/i);
  });

  it('loads and validates floorplan JSON via fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              defaultFloorId: 'ground',
              floors: [
                {
                  id: 'ground',
                  name: 'Ground Floor',
                  rooms: [
                    {
                      id: 'kitchen',
                      name: 'Kitchen',
                      points: [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                      ],
                    },
                  ],
                },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    const model = await loadFloorplanModelJson('/data/floorplan.json');
    expect(model.floors).toHaveLength(1);
  });

  it('throws when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 404 }))
    );

    await expect(loadFloorplanModelJson('/data/floorplan.json')).rejects.toThrow(/failed to load/i);
  });
});
