import { describe, expect, it } from 'vitest';
import { getAreaHumidity, getAreaTemperature, normalizeClimate } from './climate';

describe('normalizeClimate', () => {
  it('returns defaults for non-object input', () => {
    const model = normalizeClimate(null);
    expect(model.thermostat.measuredTemperature).toBeTypeOf('number');
    expect(model.areas).toEqual([]);
  });

  it('normalizes thermostat and areas', () => {
    const model = normalizeClimate({
      thermostat: {
        default: {
          name: 'Home Temperature',
          unit: '°F',
          precision: 1,
          set_temperature: 70,
          hvac_mode: 'cool',
          fan_mode: 'auto',
          measured_temperature: 76,
          measured_humidity: 40,
        },
      },
      areas: [
        { area_id: 'kitchen', temp: 80, humidity: null },
        { area_id: 'bedroom', temp: 68, humidity: 54 },
        { area_id: 123, temp: 1 },
      ],
    });

    expect(model.thermostat.measuredTemperature).toBe(76);
    expect(getAreaTemperature(model, 'kitchen')).toBe(80);
    expect(getAreaHumidity(model, 'kitchen')).toBeUndefined();
    expect(getAreaHumidity(model, 'bedroom')).toBe(54);
  });
});
