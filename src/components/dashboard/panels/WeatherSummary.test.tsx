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
    getEntityIdsByLabelNameMock.mockResolvedValue(new Set());

    useEntityStore.persist.clearStorage();
    useEntityStore.setState({ entitiesById: {}, lastUpdatedAt: null });
  });

  it('renders placeholders when no matching entities exist', () => {
    render(<WeatherSummary />);
    expect(screen.getByLabelText(/weather summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('renders temperature and humidity from entities labeled Weather', async () => {
    getEntityIdsByLabelNameMock.mockResolvedValue(
      new Set(['sensor.weather_temperature', 'sensor.weather_humidity'])
    );

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
});
