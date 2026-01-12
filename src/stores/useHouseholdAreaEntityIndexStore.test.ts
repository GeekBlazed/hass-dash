import { afterEach, describe, expect, it } from 'vitest';

import { useHouseholdAreaEntityIndexStore } from './useHouseholdAreaEntityIndexStore';

describe('useHouseholdAreaEntityIndexStore', () => {
  afterEach(() => {
    useHouseholdAreaEntityIndexStore.getState().clear();
  });

  it('normalizes device ids and entity ids into lookup records', () => {
    const { setIndex } = useHouseholdAreaEntityIndexStore.getState();

    setIndex({
      areaNameById: {
        area_a: 'Area A',
        area_b: undefined,
      },
      householdDeviceIdsByAreaId: {
        area_a: ['device_1', 'device_2'],
        area_b: new Set(['device_3']),
      },
      householdEntityIdsByAreaId: {
        area_a: {
          temperature: ['sensor.kitchen_temperature'],
          humidity: ['sensor.kitchen_humidity'],
          light: ['light.lamp'],
        },
      },
    });

    const state = useHouseholdAreaEntityIndexStore.getState();

    expect(state.areaNameById).toEqual({ area_a: 'Area A', area_b: undefined });

    expect(state.householdDeviceIdsByAreaId).toEqual({
      area_a: { device_1: true, device_2: true },
      area_b: { device_3: true },
    });

    expect(state.householdEntityIdsByAreaId).toEqual({
      area_a: {
        temperature: { 'sensor.kitchen_temperature': true },
        humidity: { 'sensor.kitchen_humidity': true },
        light: { 'light.lamp': true },
      },
    });
  });

  it('fills missing kinds as empty objects', () => {
    const { setIndex } = useHouseholdAreaEntityIndexStore.getState();

    setIndex({
      areaNameById: { area_a: 'Area A' },
      householdDeviceIdsByAreaId: { area_a: [] },
      householdEntityIdsByAreaId: {
        area_a: {
          temperature: ['sensor.only_temperature'],
          // humidity and light intentionally missing
        } as never,
      },
    });

    const state = useHouseholdAreaEntityIndexStore.getState();

    expect(state.householdEntityIdsByAreaId.area_a.temperature).toEqual({
      'sensor.only_temperature': true,
    });
    expect(state.householdEntityIdsByAreaId.area_a.humidity).toEqual({});
    expect(state.householdEntityIdsByAreaId.area_a.light).toEqual({});
  });

  it('clear resets all index maps', () => {
    const { setIndex, clear } = useHouseholdAreaEntityIndexStore.getState();

    setIndex({
      areaNameById: { area_a: 'Area A' },
      householdDeviceIdsByAreaId: { area_a: ['device_1'] },
      householdEntityIdsByAreaId: {
        area_a: {
          temperature: ['sensor.kitchen_temperature'],
          humidity: [],
          light: [],
        },
      },
    });

    clear();

    const state = useHouseholdAreaEntityIndexStore.getState();
    expect(state.areaNameById).toEqual({});
    expect(state.householdDeviceIdsByAreaId).toEqual({});
    expect(state.householdEntityIdsByAreaId).toEqual({});
  });
});
