import { readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { PublicFloorplanYamlDataSource } from './PublicFloorplanYamlDataSource';

const floorplanSchemaPath = resolvePath(process.cwd(), 'public/schemas/floorplan.schema.json');

const floorplanSchema = JSON.parse(readFileSync(floorplanSchemaPath, 'utf-8')) as object;

const createFetchStub = (
  yamlResponse: Response
): ((input: RequestInfo | URL) => Promise<Response>) => {
  return async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.endsWith('/data/floorplan.yaml')) return yamlResponse;
    if (url.endsWith('/schemas/floorplan.schema.json')) {
      return new Response(JSON.stringify(floorplanSchema), { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  };
};

describe('PublicFloorplanYamlDataSource', () => {
  it('loads and normalizes /data/floorplan.yaml', async () => {
    const yaml = `default_floor_id: ground
floors:
  - id: ground
    name: Ground
    initial_scale: 1.5
    initial_x: 0
    initial_y: -2
    bounds: [[0, 0, 0], [10, 10, 2]]
    rooms:
      - id: kitchen
        name: Kitchen
        points:
          - [0, 0]
          - [1, 0]
          - [1, 1]
`;

    vi.stubGlobal('fetch', vi.fn(createFetchStub(new Response(yaml, { status: 200 }))));

    const ds = new PublicFloorplanYamlDataSource();
    const model = await ds.getFloorplan();

    expect(model.defaultFloorId).toBe('ground');
    expect(model.floors).toHaveLength(1);
    expect(model.floors[0]?.rooms[0]?.id).toBe('kitchen');
  });

  it('throws when /data/floorplan.yaml is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(createFetchStub(new Response('Not found', { status: 404 }))));

    const ds = new PublicFloorplanYamlDataSource();

    await expect(ds.getFloorplan()).rejects.toThrow(/failed to load/i);
  });

  it('throws when YAML is unparseable', async () => {
    vi.stubGlobal('fetch', vi.fn(createFetchStub(new Response(':\n- [', { status: 200 }))));

    const ds = new PublicFloorplanYamlDataSource();

    await expect(ds.getFloorplan()).rejects.toBeInstanceOf(Error);
  });

  it('throws when normalized model fails schema validation', async () => {
    const yaml = `default_floor_id: ground
floors: []
`;

    vi.stubGlobal('fetch', vi.fn(createFetchStub(new Response(yaml, { status: 200 }))));

    const ds = new PublicFloorplanYamlDataSource();

    await expect(ds.getFloorplan()).rejects.toThrow(/schema validation failed/i);
  });
});
