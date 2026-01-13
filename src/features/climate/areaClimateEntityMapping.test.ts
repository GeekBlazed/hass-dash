import { describe, expect, it } from 'vitest';

import {
  DEFAULT_AREA_HUMIDITY_ENTITY_CANDIDATES,
  DEFAULT_AREA_TEMP_ENTITY_CANDIDATES,
  parseAreaClimateEntityMapping,
} from './areaClimateEntityMapping';

describe('areaClimateEntityMapping', () => {
  it('returns empty mapping when unset', () => {
    expect(parseAreaClimateEntityMapping(undefined)).toEqual({});
    expect(parseAreaClimateEntityMapping('')).toEqual({});
    expect(parseAreaClimateEntityMapping('   ')).toEqual({});
  });

  it('parses a JSON mapping of areaId -> entity ids', () => {
    const mapping = parseAreaClimateEntityMapping(
      JSON.stringify({
        kitchen: {
          temperature: 'sensor.kitchen_temperature',
          humidity: 'sensor.kitchen_humidity',
        },
      })
    );

    expect(mapping).toEqual({
      kitchen: {
        temperature: 'sensor.kitchen_temperature',
        humidity: 'sensor.kitchen_humidity',
      },
    });
  });

  it('ignores invalid JSON', () => {
    expect(parseAreaClimateEntityMapping('{nope')).toEqual({});
  });

  it('ignores entries without entity ids', () => {
    const mapping = parseAreaClimateEntityMapping(JSON.stringify({ kitchen: {}, office: null }));
    expect(mapping).toEqual({});
  });

  it('generates temp candidates for hyphenated area ids', () => {
    const candidates = DEFAULT_AREA_TEMP_ENTITY_CANDIDATES('living-room');

    expect(candidates).toContain('sensor.living-room_temperature');
    expect(candidates).toContain('sensor.living_room_temperature');
  });

  it('generates humidity candidates for hyphenated area ids', () => {
    const candidates = DEFAULT_AREA_HUMIDITY_ENTITY_CANDIDATES('living-room');

    expect(candidates).toContain('sensor.living-room_humidity');
    expect(candidates).toContain('sensor.living_room_humidity');
  });

  it('deduplicates candidates when area id already matches HA conventions', () => {
    const candidates = DEFAULT_AREA_TEMP_ENTITY_CANDIDATES('kitchen');

    // Should not contain duplicate strings even though internal variants repeat.
    expect(new Set(candidates).size).toBe(candidates.length);
  });
});
