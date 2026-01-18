import { render, screen } from '@testing-library/react';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import type { HaEntityState } from '../../../types/home-assistant';

const mockedState = vi.hoisted(() => {
  return {
    entitiesById: {} as Record<string, HaEntityState>,
    householdEntityIdsByAreaId: {} as Record<
      string,
      {
        temperature: Record<string, true>;
        humidity: Record<string, true>;
        light: Record<string, true>;
      }
    >,
    areaNameById: {} as Record<string, string | undefined>,
  };
});

vi.mock('../../../stores/useEntityStore', () => {
  return {
    useEntityStore: ((selector: (s: { entitiesById: Record<string, HaEntityState> }) => unknown) =>
      selector({ entitiesById: mockedState.entitiesById })) as unknown as Mock,
  };
});

vi.mock('../../../stores/useHouseholdAreaEntityIndexStore', () => {
  return {
    useHouseholdAreaEntityIndexStore: ((
      selector: (s: {
        householdEntityIdsByAreaId: typeof mockedState.householdEntityIdsByAreaId;
        areaNameById: typeof mockedState.areaNameById;
      }) => unknown
    ) =>
      selector({
        householdEntityIdsByAreaId: mockedState.householdEntityIdsByAreaId,
        areaNameById: mockedState.areaNameById,
      })) as unknown as Mock,
  };
});

import { ClimatePanel } from './ClimatePanel';

const createEntity = (params: {
  id: string;
  state: string;
  deviceClass?: string;
  unit?: string;
}): HaEntityState => {
  return {
    entity_id: params.id,
    state: params.state,
    attributes: {
      ...(params.deviceClass ? { device_class: params.deviceClass } : {}),
      ...(params.unit ? { unit_of_measurement: params.unit } : {}),
    },
    last_changed: '2026-01-01T00:00:00.000Z',
    last_updated: '2026-01-01T00:00:00.000Z',
  };
};

describe('ClimatePanel', () => {
  it('uses household summary sensors when available', () => {
    mockedState.areaNameById = {};
    mockedState.householdEntityIdsByAreaId = {};
    mockedState.entitiesById = {
      'sensor.household_temperature_mean_weighted': createEntity({
        id: 'sensor.household_temperature_mean_weighted',
        state: '72.2',
        deviceClass: 'temperature',
        unit: '°F',
      }),
      'sensor.household_temperature_minimum': createEntity({
        id: 'sensor.household_temperature_minimum',
        state: '68.1',
        deviceClass: 'temperature',
        unit: '°F',
      }),
      'sensor.household_temperature_maximum': createEntity({
        id: 'sensor.household_temperature_maximum',
        state: '77.9',
        deviceClass: 'temperature',
        unit: '°F',
      }),
      'sensor.household_humidity_weighted_mean': createEntity({
        id: 'sensor.household_humidity_weighted_mean',
        state: '43.2',
        deviceClass: 'humidity',
        unit: '%',
      }),
    };

    const { container } = render(<ClimatePanel />);

    expect(screen.getByRole('region', { name: /climate controls/i })).toBeInTheDocument();
    expect(container.querySelector('#thermostat-temp')?.textContent).toBe('72°F');
    expect(container.querySelector('#thermostat-humidity')?.textContent).toBe('43.2%');
    expect(container.querySelector('#temp-range-min')?.textContent).toBe('68°F');
    expect(container.querySelector('#temp-range-max')?.textContent).toBe('78°F');
  });

  it('falls back to area aggregation when household summaries are missing', () => {
    mockedState.areaNameById = {
      living_room: 'Living Room',
    };
    mockedState.householdEntityIdsByAreaId = {
      living_room: {
        temperature: {
          'sensor.living_room_temperature': true,
        },
        humidity: {
          'sensor.living_room_humidity': true,
          'sensor.living_room_humidity_invalid': true,
        },
        light: {},
      },
    };
    mockedState.entitiesById = {
      'sensor.living_room_temperature': createEntity({
        id: 'sensor.living_room_temperature',
        state: '21.4',
        deviceClass: 'temperature',
        unit: '°C',
      }),
      'sensor.living_room_humidity': createEntity({
        id: 'sensor.living_room_humidity',
        state: '40',
        deviceClass: 'humidity',
        unit: '%',
      }),
      'sensor.living_room_humidity_invalid': createEntity({
        id: 'sensor.living_room_humidity_invalid',
        state: '-100',
        deviceClass: 'humidity',
        unit: '%',
      }),
    };

    const { container } = render(<ClimatePanel isHidden />);

    expect(screen.getByRole('region', { name: /climate controls/i }).className).toContain(
      'is-hidden'
    );
    expect(container.querySelector('#thermostat-temp')?.textContent).toBe('21°C');
    expect(container.querySelector('#thermostat-humidity')?.textContent).toBe('40%');
    expect(container.querySelector('#temp-range-min')?.textContent).toBe('21°C');
    expect(container.querySelector('#temp-range-max')?.textContent).toBe('21°C');
  });
});
