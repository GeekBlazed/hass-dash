import { describe, expect, it, vi } from 'vitest';

import { PublicClimateYamlDataSource } from './PublicClimateYamlDataSource';

describe('PublicClimateYamlDataSource', () => {
  it('loads and normalizes /data/climate.yaml', async () => {
    const yaml = `thermostat:
  default:
    measured_temperature: 76
    measured_humidity: 40
    set_temperature: 70
    hvac_mode: cool
areas:
  - area_id: kitchen
    temp: 80
    humidity: null
`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(yaml, { status: 200 }))
    );

    const ds = new PublicClimateYamlDataSource();
    const model = await ds.getClimate();

    expect(model.thermostat.measuredTemperature).toBe(76);
    expect(model.thermostat.measuredHumidity).toBe(40);
    expect(model.areas[0]?.areaId).toBe('kitchen');
  });

  it('throws when /data/climate.yaml is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Not found', { status: 404 }))
    );

    const ds = new PublicClimateYamlDataSource();

    await expect(ds.getClimate()).rejects.toThrow(/failed to load/i);
  });

  it('throws when YAML is unparseable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(':\n- [', { status: 200 }))
    );

    const ds = new PublicClimateYamlDataSource();

    await expect(ds.getClimate()).rejects.toBeInstanceOf(Error);
  });
});
