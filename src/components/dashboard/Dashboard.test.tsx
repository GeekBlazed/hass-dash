import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useEntityStore } from '../../stores/useEntityStore';
import { useHouseholdAreaEntityIndexStore } from '../../stores/useHouseholdAreaEntityIndexStore';
import type { HaEntityState } from '../../types/home-assistant';
import { Dashboard } from './Dashboard';

async function renderAndSettle(ui: ReactElement): Promise<void> {
  render(ui);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('Dashboard', () => {
  beforeEach(() => {
    useDashboardStore.persist.clearStorage();
    useEntityStore.persist.clearStorage();
    useHouseholdAreaEntityIndexStore.getState().clear();
    useDashboardStore.setState({
      activePanel: 'climate',
      isMapControlsOpen: false,
      stageView: { x: 0, y: 0, scale: 1 },
    });

    useEntityStore.setState({ entitiesById: {}, lastUpdatedAt: null });
  });

  it('should render the floorplan application shell', async () => {
    await renderAndSettle(<Dashboard />);
    expect(screen.getByRole('application', { name: /floorplan dashboard/i })).toBeInTheDocument();
  });

  it('should render the sidebar brand and weather summary', async () => {
    await renderAndSettle(<Dashboard />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText(/weather summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('should render quick action buttons', async () => {
    await renderAndSettle(<Dashboard />);
    expect(screen.getByRole('button', { name: /^lighting$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^climate$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^media$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^agenda$/i })).toBeInTheDocument();
  });

  it('should render the climate panel thermostat values', async () => {
    const makeEntity = (entityId: string, state: string): HaEntityState => ({
      entity_id: entityId,
      state,
      attributes: { unit_of_measurement: '°F', friendly_name: entityId },
      last_changed: '2026-01-01T00:00:00.000Z',
      last_updated: '2026-01-01T00:00:00.000Z',
      context: { id: 'ctx', parent_id: null, user_id: null },
    });

    useEntityStore
      .getState()
      .upsert(makeEntity('sensor.household_temperature_mean_weighted', '73.6'));
    useEntityStore.getState().upsert(makeEntity('sensor.household_temperature_minimum', '70.1'));
    useEntityStore.getState().upsert(makeEntity('sensor.household_temperature_maximum', '78.2'));
    useEntityStore.getState().upsert({
      ...makeEntity('sensor.household_humidity_weighted_mean', '45.2'),
      attributes: { unit_of_measurement: '%', device_class: 'humidity', friendly_name: 'Humidity' },
    });

    await renderAndSettle(<Dashboard />);
    expect(screen.getByLabelText(/climate controls/i)).toBeInTheDocument();
    expect(screen.getByText(/74°F/i)).toBeInTheDocument();
    expect(screen.getByText(/45\.2%/i)).toBeInTheDocument();
  });

  it('should ignore invalid household humidity and fall back to calculated average', async () => {
    const makeEntity = (entityId: string, state: string): HaEntityState => ({
      entity_id: entityId,
      state,
      attributes: { unit_of_measurement: '%', device_class: 'humidity', friendly_name: entityId },
      last_changed: '2026-01-01T00:00:00.000Z',
      last_updated: '2026-01-01T00:00:00.000Z',
      context: { id: 'ctx', parent_id: null, user_id: null },
    });

    // Household summary humidity present but invalid (common sentinel value in templates)
    useEntityStore.getState().upsert(makeEntity('sensor.household_humidity_weighted_mean', '-100'));

    // Provide one area humidity sensor so the calculated fallback can produce a sensible value.
    useHouseholdAreaEntityIndexStore.setState({
      householdEntityIdsByAreaId: {
        area_a: {
          temperature: {},
          humidity: { 'sensor.kitchen_humidity': true },
          light: {},
        },
      },
      areaNameById: { area_a: 'Kitchen' },
    });

    useEntityStore.getState().upsert(makeEntity('sensor.kitchen_humidity', '43.2'));

    await renderAndSettle(<Dashboard />);
    expect(screen.getByLabelText(/climate controls/i)).toBeInTheDocument();
    expect(screen.getByText(/43\.2%/i)).toBeInTheDocument();
  });

  it('should render the floorplan stage and svg container', async () => {
    await renderAndSettle(<Dashboard />);
    expect(screen.getByRole('main', { name: /floorplan/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /home floorplan \(from yaml\)/i })).toBeInTheDocument();
  });

  it('should include a floorplan empty state container', async () => {
    await renderAndSettle(<Dashboard />);
    expect(screen.getByRole('heading', { name: /floorplan not loaded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should switch sidebar panels via quick actions', async () => {
    const user = userEvent.setup();
    const { container } = render(<Dashboard />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const lightingButton = screen.getByRole('button', { name: /^lighting$/i });
    const climateButton = screen.getByRole('button', { name: /^climate$/i });
    const agendaButton = screen.getByRole('button', { name: /^agenda$/i });

    const lightingPanel = container.querySelector('#lighting-panel');
    const climatePanel = container.querySelector('#climate-panel');
    const agendaPanel = container.querySelector('#agenda');

    expect(lightingPanel).not.toBeNull();
    expect(climatePanel).not.toBeNull();
    expect(agendaPanel).not.toBeNull();

    expect(climateButton).toHaveAttribute('aria-expanded', 'true');
    expect(lightingButton).toHaveAttribute('aria-expanded', 'false');

    expect(climatePanel).not.toHaveClass('is-hidden');
    expect(lightingPanel).toHaveClass('is-hidden');

    await user.click(lightingButton);
    expect(lightingButton).toHaveAttribute('aria-expanded', 'true');
    expect(climateButton).toHaveAttribute('aria-expanded', 'false');
    expect(lightingPanel).not.toHaveClass('is-hidden');
    expect(climatePanel).toHaveClass('is-hidden');

    await user.click(agendaButton);
    expect(agendaButton).toHaveAttribute('aria-expanded', 'true');
    expect(lightingButton).toHaveAttribute('aria-expanded', 'false');
    expect(agendaPanel).not.toHaveClass('is-hidden');
    expect(lightingPanel).toHaveClass('is-hidden');

    await user.click(agendaButton);
    expect(agendaButton).toHaveAttribute('aria-expanded', 'false');
    expect(agendaPanel).toHaveClass('is-hidden');
  });

  it('should include the lighting empty state copy', async () => {
    const user = userEvent.setup();
    await renderAndSettle(<Dashboard />);

    await user.click(screen.getByRole('button', { name: /^lighting$/i }));

    expect(screen.getByText('There are no lights on.')).toBeInTheDocument();
  });
});
