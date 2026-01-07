import { describe, expect, it, vi } from 'vitest';

import { PublicFloorplanYamlDataSource } from './PublicFloorplanYamlDataSource';

describe('PublicFloorplanYamlDataSource', () => {
  it('loads and normalizes /data/floorplan.yaml', async () => {
    const yaml = `default_floor_id: ground
floors:
  - id: ground
    name: Ground
    rooms:
      - id: kitchen
        name: Kitchen
        points:
          - [0, 0]
          - [1, 0]
          - [1, 1]
`;

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(yaml, {
            status: 200,
          })
      )
    );

    const ds = new PublicFloorplanYamlDataSource();
    const model = await ds.getFloorplan();

    expect(model.defaultFloorId).toBe('ground');
    expect(model.floors).toHaveLength(1);
    expect(model.floors[0]?.rooms[0]?.id).toBe('kitchen');
  });

  it('throws when /data/floorplan.yaml is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not found', { status: 404 }))
    );

    const ds = new PublicFloorplanYamlDataSource();

    await expect(ds.getFloorplan()).rejects.toThrow(/failed to load/i);
  });

  it('throws when YAML is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(':\n- [', { status: 200 }))
    );

    const ds = new PublicFloorplanYamlDataSource();

    await expect(ds.getFloorplan()).rejects.toBeInstanceOf(Error);
  });
});
