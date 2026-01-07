import { describe, expect, it, vi } from 'vitest';

import { PublicLightingYamlDataSource } from './PublicLightingYamlDataSource';

describe('PublicLightingYamlDataSource', () => {
  it('loads and normalizes /data/lighting.yaml', async () => {
    const yaml = `lights:
  - id: light.kitchen
    name: Kitchen Light
    state: on
`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(yaml, { status: 200 }))
    );

    const ds = new PublicLightingYamlDataSource();
    const model = await ds.getLighting();

    expect(model.lights).toHaveLength(1);
    expect(model.lights[0]?.id).toBe('light.kitchen');
    expect(model.lights[0]?.state).toBe('on');
  });

  it('returns empty model when /data/lighting.yaml is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not found', { status: 404 }))
    );

    const ds = new PublicLightingYamlDataSource();
    const model = await ds.getLighting();

    expect(model.lights).toEqual([]);
  });

  it('returns empty model when YAML is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(':\n- [', { status: 200 }))
    );

    const ds = new PublicLightingYamlDataSource();
    const model = await ds.getLighting();

    expect(model.lights).toEqual([]);
  });
});
