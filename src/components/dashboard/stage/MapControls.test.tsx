import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FloorplanModel } from '../../../features/model/floorplan';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { MapControls } from './MapControls';

describe('MapControls', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      activePanel: 'climate',
      overlays: {
        tracking: true,
        climate: true,
        lighting: false,
      },
      isMapControlsOpen: false,
      stageView: { x: 0, y: 0, scale: 1 },
      stageFontScale: 1,
      stageIconScale: 1,
      floorplan: { state: 'idle', model: null, errorMessage: null },
    });
  });

  it('toggles overlays via the overlay buttons', () => {
    render(<MapControls isOpen={true} />);

    expect(useDashboardStore.getState().overlays.lighting).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Lighting overlay' }));
    expect(useDashboardStore.getState().overlays.lighting).toBe(true);

    expect(useDashboardStore.getState().overlays.climate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Climate overlay' }));
    expect(useDashboardStore.getState().overlays.climate).toBe(false);
  });

  it('applies is-hidden when closed, and not when open', () => {
    const { rerender } = render(<MapControls isOpen={false} />);

    const root = screen.getByLabelText('Map controls');
    expect(root.getAttribute('class') ?? '').toContain('is-hidden');

    rerender(<MapControls isOpen={true} />);
    expect(root.getAttribute('class') ?? '').not.toContain('is-hidden');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();

    render(<MapControls isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide map controls' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pans the stage view when floorplan model is available', () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              points: [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
              ],
            },
          ],
        },
      ],
    };

    useDashboardStore.getState().setFloorplanLoaded(model);

    render(<MapControls isOpen={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pan right' }));
    expect(useDashboardStore.getState().stageView.x).toBeCloseTo(-1.25);

    fireEvent.click(screen.getByRole('button', { name: 'Pan up' }));
    // Pan buttons should move the content in the button direction.
    // With the updated pan math, that means the view origin moves opposite.
    expect(useDashboardStore.getState().stageView.x).toBeCloseTo(-1.25);
    expect(useDashboardStore.getState().stageView.y).toBeCloseTo(1.25);
  });

  it('zooms via the slider when floorplan model is available', () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              points: [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
              ],
            },
          ],
        },
      ],
    };

    useDashboardStore.getState().setFloorplanLoaded(model);

    render(<MapControls isOpen={true} />);

    const slider = screen.getByRole('slider', { name: 'Zoom' });
    fireEvent.change(slider, { target: { value: '200' } });

    const view = useDashboardStore.getState().stageView;
    expect(view.scale).toBe(2);
    expect(view.x).toBeCloseTo(3.125);
    expect(view.y).toBeCloseTo(3.125);
  });

  it('updates marker/icon scale via the slider', () => {
    render(<MapControls isOpen={true} />);

    expect(useDashboardStore.getState().stageIconScale).toBe(1);

    const slider = screen.getByRole('slider', { name: 'Markers / icons' });
    fireEvent.change(slider, { target: { value: '175' } });

    expect(useDashboardStore.getState().stageIconScale).toBeCloseTo(1.75);
  });

  it('does nothing for pan/zoom when the base viewBox is unavailable', () => {
    render(<MapControls isOpen={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pan right' }));
    expect(useDashboardStore.getState().stageView.x).toBe(0);

    const slider = screen.getByRole('slider', { name: 'Zoom' });
    fireEvent.change(slider, { target: { value: '200' } });
    expect(useDashboardStore.getState().stageView.scale).toBe(1);
  });
});
