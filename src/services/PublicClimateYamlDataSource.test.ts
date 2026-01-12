import { describe, expect, it, vi } from 'vitest';

import { PublicClimateYamlDataSource } from './PublicClimateYamlDataSource';

describe('PublicClimateYamlDataSource', () => {
  it('returns an empty model and does not fetch any YAML', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('thermostat: {}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const ds = new PublicClimateYamlDataSource();
    const model = await ds.getClimate();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(model.areas).toEqual([]);
    expect(typeof model.thermostat.name).toBe('string');
    expect(typeof model.thermostat.unit).toBe('string');
    expect(typeof model.thermostat.precision).toBe('number');
    expect(typeof model.thermostat.setTemperature).toBe('number');
    expect(typeof model.thermostat.hvacMode).toBe('string');
    expect(typeof model.thermostat.measuredTemperature).toBe('number');
  });
});
