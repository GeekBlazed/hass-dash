import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  beforeEach(() => {
    useDashboardStore.persist.clearStorage();
    useDashboardStore.setState({
      activePanel: 'climate',
      stageView: { x: 0, y: 0, scale: 1 },
    });
  });

  it('should render the floorplan application shell', () => {
    render(<Dashboard />);
    expect(screen.getByRole('application', { name: /floorplan prototype/i })).toBeInTheDocument();
  });

  it('should render the sidebar brand and weather summary', () => {
    render(<Dashboard />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText(/weather summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Humidity:/i)).toBeInTheDocument();
  });

  it('should render quick action buttons', () => {
    render(<Dashboard />);
    expect(screen.getByRole('button', { name: /lighting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /climate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument();
  });

  it('should render the climate panel thermostat values', () => {
    render(<Dashboard />);
    expect(screen.getByLabelText(/climate controls/i)).toBeInTheDocument();
    expect(screen.getByText(/71°F/i)).toBeInTheDocument();
    expect(screen.getByText(/47%/i)).toBeInTheDocument();
  });

  it('should render the floorplan stage and svg container', () => {
    render(<Dashboard />);
    expect(screen.getByRole('main', { name: /floorplan/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /home floorplan \(from yaml\)/i })).toBeInTheDocument();
  });

  it('should include a floorplan empty state container', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: /floorplan not loaded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should switch sidebar panels via quick actions', async () => {
    const user = userEvent.setup();
    const { container } = render(<Dashboard />);

    const lightingButton = screen.getByRole('button', { name: /lighting/i });
    const climateButton = screen.getByRole('button', { name: /climate/i });
    const agendaButton = screen.getByRole('button', { name: /agenda/i });

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
    render(<Dashboard />);

    await user.click(screen.getByRole('button', { name: /lighting/i }));

    expect(screen.getByText('There are no lights on.')).toBeInTheDocument();
  });
});
