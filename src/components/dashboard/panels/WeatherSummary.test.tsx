import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { WeatherSummary } from './WeatherSummary';

const getEntityIdsByLabelNameMock = vi.fn<(labelName: string) => Promise<ReadonlySet<string>>>(() =>
  Promise.resolve(new Set())
);

vi.mock('../../../hooks/useService', () => {
  return {
    useService: () => ({
      getEntityIdsByLabelName: getEntityIdsByLabelNameMock,
    }),
  };
});

const makeEntity = (
  entityId: string,
  state: string,
  attributes: Record<string, unknown>
): HaEntityState => ({
  entity_id: entityId,
  state,
  attributes,
  last_changed: '2026-01-01T00:00:00.000Z',
  last_updated: '2026-01-01T00:00:00.000Z',
  context: { id: 'ctx', parent_id: null, user_id: null },
});

describe('WeatherSummary', () => {
  beforeEach(() => {
    getEntityIdsByLabelNameMock.mockReset();
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') return Promise.resolve(new Set());
      if (labelName === 'hass-dash') return Promise.resolve(new Set());
      if (labelName === 'Weather Description') return Promise.resolve(new Set());
      return Promise.resolve(new Set());
    });

    useEntityStore.persist.clearStorage();
    useEntityStore.setState({ entitiesById: {}, lastUpdatedAt: null });
  });

  it('renders placeholders when no matching entities exist', () => {
    render(<WeatherSummary />);
    expect(screen.getByLabelText(/weather summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('renders temperature and humidity from entities labeled Weather', async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') {
        return Promise.resolve(new Set(['sensor.weather_temperature', 'sensor.weather_humidity']));
      }
      return Promise.resolve(new Set());
    });

    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_temperature', '72.4', {
        device_class: 'temperature',
        unit_of_measurement: '°F',
      })
    );

    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_humidity', '55', {
        device_class: 'humidity',
        unit_of_measurement: '%',
      })
    );

    render(<WeatherSummary />);

    expect(await screen.findByText('72°F')).toBeInTheDocument();
    expect(await screen.findByText(/Humidity:\s*55%/i)).toBeInTheDocument();
  });

  it('falls back to matching label/friendly_name when label registry is empty', async () => {
    getEntityIdsByLabelNameMock.mockImplementation(() => Promise.resolve(new Set()));

    useEntityStore.getState().upsert(
      makeEntity('sensor.outdoor_temp', '21.4', {
        device_class: 'temperature',
        friendly_name: 'Weather',
      })
    );

    useEntityStore.getState().upsert(
      makeEntity('sensor.outdoor_humidity', '55.0', {
        device_class: 'humidity',
        // Prefer `label` when present.
        label: '  Weather  ',
      })
    );

    render(<WeatherSummary />);

    expect(await screen.findByText('21°F')).toBeInTheDocument();
    expect(await screen.findByText(/Humidity:\s*55%/i)).toBeInTheDocument();
  });

  it('shows placeholders for invalid humidity values (out of 0..100 range)', async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') {
        return Promise.resolve(new Set(['sensor.weather_temperature']));
      }
      return Promise.resolve(new Set());
    });

    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_temperature', '72.4', {
        device_class: 'temperature',
        unit_of_measurement: '°F',
      })
    );

    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_humidity', '101', {
        device_class: 'humidity',
        label: 'Weather',
      })
    );

    render(<WeatherSummary />);

    expect(await screen.findByText('72°F')).toBeInTheDocument();
    expect(await screen.findByText(/Humidity:\s*--%/i)).toBeInTheDocument();
  });

  it('defaults to °F when unit is missing/blank and state is non-numeric', () => {
    useEntityStore.getState().upsert(
      makeEntity('sensor.bad_temp', 'not-a-number', {
        device_class: 'temperature',
        label: 'Weather',
        unit_of_measurement: '   ',
      })
    );

    render(<WeatherSummary />);
    expect(screen.getByText('--°F')).toBeInTheDocument();
  });

  it('skips missing/invalid labeled entity ids until it finds a valid match', async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') {
        return Promise.resolve(
          new Set([
            'sensor.missing',
            'sensor.wrong_class',
            'sensor.invalid_temp',
            'sensor.weather_temperature',
          ])
        );
      }
      return Promise.resolve(new Set());
    });

    useEntityStore.getState().upsert(
      makeEntity('sensor.wrong_class', '72', {
        device_class: 'humidity',
        unit_of_measurement: '%',
      })
    );

    useEntityStore.getState().upsert(
      makeEntity('sensor.invalid_temp', 'not-a-number', {
        device_class: 'temperature',
        unit_of_measurement: '°F',
      })
    );

    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_temperature', '72.4', {
        device_class: 'temperature',
        unit_of_measurement: '°F',
      })
    );

    render(<WeatherSummary />);

    expect(await screen.findByText('72°F')).toBeInTheDocument();
  });

  it('retries label resolution after a transient failure once entity store updates', async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') {
        return Promise.reject(new Error('temporary'));
      }
      return Promise.resolve(new Set());
    });

    render(<WeatherSummary />);

    // First attempt (failure)
    expect(
      getEntityIdsByLabelNameMock.mock.calls.filter(([label]) => label === 'Weather')
    ).toHaveLength(1);

    // Update the mock to succeed on retry.
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'Weather') {
        return Promise.resolve(new Set(['sensor.weather_temperature']));
      }
      return Promise.resolve(new Set());
    });

    // Trigger a store update (lastUpdatedAt changes), causing the effect to retry.
    useEntityStore.getState().upsert(
      makeEntity('sensor.weather_temperature', '72.4', {
        device_class: 'temperature',
        unit_of_measurement: '°F',
      })
    );

    expect(await screen.findByText('72°F')).toBeInTheDocument();
    expect(
      getEntityIdsByLabelNameMock.mock.calls.filter(([label]) => label === 'Weather')
    ).toHaveLength(2);
  });

  it('populates the description from an entity labeled hass-dash + Weather Description', async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'hass-dash')
        return Promise.resolve(new Set(['sensor.weather_description']));
      if (labelName === 'Weather Description') {
        return Promise.resolve(new Set(['sensor.weather_description']));
      }
      return Promise.resolve(new Set());
    });

    useEntityStore
      .getState()
      .upsert(makeEntity('sensor.weather_description', 'Partly cloudy', { friendly_name: 'Wx' }));

    render(<WeatherSummary />);

    expect(await screen.findByText('Partly Cloudy')).toBeInTheDocument();
  });

  it("formats dashed weather descriptions (e.g. 'lightning-rainy')", async () => {
    getEntityIdsByLabelNameMock.mockImplementation((labelName: string) => {
      if (labelName === 'hass-dash')
        return Promise.resolve(new Set(['sensor.weather_description']));
      if (labelName === 'Weather Description') {
        return Promise.resolve(new Set(['sensor.weather_description']));
      }
      return Promise.resolve(new Set());
    });

    useEntityStore
      .getState()
      .upsert(makeEntity('sensor.weather_description', 'lightning-rainy', { friendly_name: 'Wx' }));

    render(<WeatherSummary />);

    expect(await screen.findByText('Lightning, Rainy')).toBeInTheDocument();
  });
});
