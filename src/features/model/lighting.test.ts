import { describe, expect, it } from 'vitest';
import { getOnLights, normalizeLighting } from './lighting';

describe('normalizeLighting', () => {
  it('returns empty list for non-object input', () => {
    expect(normalizeLighting(null)).toEqual({ lights: [] });
    expect(normalizeLighting('nope')).toEqual({ lights: [] });
    expect(normalizeLighting(123)).toEqual({ lights: [] });
  });

  it('normalizes valid lights and ignores invalid ones', () => {
    const model = normalizeLighting({
      lights: [
        { id: 'light.kitchen', name: 'Kitchen Light', state: 'off', brightness: 150 },
        { id: 'light.family_room', name: 'Family Room Light', state: 'on', color_temp: 4000 },
        { id: 123, name: 'Bad', state: 'on' },
        { id: 'light.bad_state', name: 'Bad', state: 'dim' },
        'nope',
      ],
    });

    expect(model.lights).toHaveLength(2);
    expect(model.lights[0]).toEqual({
      id: 'light.kitchen',
      name: 'Kitchen Light',
      state: 'off',
      brightness: 150,
      colorTemp: undefined,
    });
    expect(model.lights[1]).toEqual({
      id: 'light.family_room',
      name: 'Family Room Light',
      state: 'on',
      brightness: undefined,
      colorTemp: 4000,
    });

    expect(getOnLights(model).map((l) => l.id)).toEqual(['light.family_room']);
  });

  it('getOnLights returns empty when no lights are on', () => {
    const model = normalizeLighting({
      lights: [{ id: 'light.kitchen', name: 'Kitchen Light', state: 'off' }],
    });

    expect(getOnLights(model)).toEqual([]);
  });
});
