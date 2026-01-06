import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrototypeShell } from './PrototypeShell';

const mockLightingYaml = `
lights:
  - id: light.family_room
    name: Family Room Light
    state: on
  - id: light.kitchen
    name: Kitchen Light
    state: off
  - id: light.studio
    name: Studio Light
    state: on
`;

const mockClimateYaml = `
thermostat:
  default:
    name: Home Temperature
    unit: °F
    precision: 1
    set_temperature: 70
    hvac_mode: cool
    fan_mode: auto
    measured_temperature: 76
    measured_humidity: 40

areas:
  - area_id: family_room
    temp: 81
    humidity: 38
  - area_id: kitchen
    temp: 80
    humidity: null
  - area_id: bedroom
    temp: 68
    humidity: 54
  - area_id: office
    temp: 76
    humidity: null
`;

describe('PrototypeShell', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/UI/lighting.yaml')) {
          return new Response(mockLightingYaml, { status: 200 });
        }
        if (url.endsWith('/UI/climate.yaml')) {
          return new Response(mockClimateYaml, { status: 200 });
        }
        return new Response('', { status: 404 });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('defaults to Climate panel visible', () => {
    render(<PrototypeShell />);

    expect(screen.getByRole('button', { name: 'Climate' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('region', { name: 'Climate controls' })).toBeInTheDocument();

    // Others should be hidden (not in accessibility tree)
    expect(screen.queryByRole('region', { name: 'Agenda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lighting' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Media player' })).not.toBeInTheDocument();
  });

  it('loads climate YAML and renders thermostat values', async () => {
    render(<PrototypeShell />);

    const climateRegion = screen.getByRole('region', { name: 'Climate controls' });

    // Climate is active by default; once loaded, the measured temperature should render in the panel.
    await within(climateRegion).findByText(/76\s*°F/);
    expect(within(climateRegion).getByText(/humidity/i)).toBeInTheDocument();
  });

  it('toggles overlays with panels (climate/lighting only)', async () => {
    const user = userEvent.setup();

    render(<PrototypeShell />);

    const climateOverlay = screen.getByTestId('climate-overlay');
    const lightingOverlay = screen.getByTestId('lighting-overlay');

    // Default: climate visible
    expect(climateOverlay).not.toHaveClass('hidden');
    expect(lightingOverlay).toHaveClass('hidden');

    // Climate (active) -> Agenda; both overlays hidden
    await user.click(screen.getByRole('button', { name: 'Climate' }));
    expect(climateOverlay).toHaveClass('hidden');
    expect(lightingOverlay).toHaveClass('hidden');

    // Lighting -> lighting overlay visible
    await user.click(screen.getByRole('button', { name: 'Lighting' }));
    expect(climateOverlay).toHaveClass('hidden');
    expect(lightingOverlay).not.toHaveClass('hidden');
  });

  it('zooms and resets viewport transform', async () => {
    const user = userEvent.setup();

    render(<PrototypeShell />);

    const viewport = screen.getByTestId('floorplan-viewport');
    expect(viewport).toHaveAttribute('transform', 'translate(0 0) scale(1)');

    await user.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(viewport).toHaveAttribute('transform', 'translate(0 0) scale(1.1)');

    await user.click(screen.getByRole('button', { name: /reset view/i }));
    expect(viewport).toHaveAttribute('transform', 'translate(0 0) scale(1)');
  });

  it('pans the stage via pointer drag', async () => {
    render(<PrototypeShell />);

    const svg = screen.getByTestId('floorplan-svg');
    const viewport = screen.getByTestId('floorplan-viewport');
    expect(viewport).toHaveAttribute('transform', 'translate(0 0) scale(1)');

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 140, clientY: 130 });

    await waitFor(() => {
      expect(viewport).toHaveAttribute('transform', 'translate(40 30) scale(1)');
    });
  });

  it('renders ON lights from YAML and allows local toggle off', async () => {
    const user = userEvent.setup();
    render(<PrototypeShell />);

    await user.click(screen.getByRole('button', { name: 'Lighting' }));

    // Family Room + Studio are ON
    await screen.findByText('Family Room Light');
    expect(screen.getByText('Studio Light')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen Light')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /turn off family room light/i }));

    await waitFor(() => {
      expect(screen.queryByText('Family Room Light')).not.toBeInTheDocument();
    });
  });

  it('matches prototype toggle behavior for panels', async () => {
    const user = userEvent.setup();

    render(<PrototypeShell />);

    const agendaButton = screen.getByRole('button', { name: 'Agenda' });
    const lightingButton = screen.getByRole('button', { name: 'Lighting' });
    const climateButton = screen.getByRole('button', { name: 'Climate' });
    const mediaButton = screen.getByRole('button', { name: 'Media' });

    // Climate (active) -> Agenda
    await user.click(climateButton);
    expect(screen.getByRole('region', { name: 'Agenda' })).toBeInTheDocument();

    // Agenda (active) -> none
    await user.click(agendaButton);
    expect(screen.queryByRole('region', { name: 'Agenda' })).not.toBeInTheDocument();

    // Lighting -> visible, then Lighting again -> none
    await user.click(lightingButton);
    expect(screen.getByRole('region', { name: 'Lighting' })).toBeInTheDocument();
    await user.click(lightingButton);
    expect(screen.queryByRole('region', { name: 'Lighting' })).not.toBeInTheDocument();

    // Media -> visible, then Media again -> Agenda
    await user.click(mediaButton);
    expect(screen.getByRole('region', { name: 'Media player' })).toBeInTheDocument();
    await user.click(mediaButton);
    expect(screen.getByRole('region', { name: 'Agenda' })).toBeInTheDocument();
  });

  it('does not overflow the viewport at >=640px width (clamped container)', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 640,
    });

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    try {
      render(<PrototypeShell />);

      const shell = screen.getByTestId('prototype-shell');
      expect(shell).toHaveClass('overflow-hidden');
      expect(shell).toHaveClass('prototype-shell-clamp');
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });
});
