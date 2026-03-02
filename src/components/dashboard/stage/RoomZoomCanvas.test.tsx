import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FloorplanModel } from '../../../features/model/floorplan';
import { ROOM_ZOOM_TRANSITION_MS, useDashboardStore } from '../../../stores/useDashboardStore';
import { RoomZoomCanvas } from './RoomZoomCanvas';

type ResizeObserverCallback = (entries: Array<ResizeObserverEntry>) => void;

class MockResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('RoomZoomCanvas', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      activePanel: 'climate',
      overlays: { tracking: true, climate: true, lighting: false },
      isMapControlsOpen: false,
      stageView: { x: 0, y: 0, scale: 1 },
      stageFontScale: 1,
      stageIconScale: 1,
      roomZoom: {
        mode: 'none',
        roomId: null,
        stageView: null,
        previousStageView: null,
        targetStageView: null,
      },
      floorplan: { state: 'idle', model: null, errorMessage: null },
    });

    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver;

    const win = globalThis as unknown as {
      SVGElement?: unknown;
      SVGTextElement?: unknown;
      SVGCircleElement?: unknown;
    };
    if (typeof win.SVGTextElement === 'undefined' && typeof win.SVGElement !== 'undefined') {
      win.SVGTextElement = win.SVGElement;
    }
    if (typeof win.SVGCircleElement === 'undefined' && typeof win.SVGElement !== 'undefined') {
      win.SVGCircleElement = win.SVGElement;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a mini-map and exits room zoom on click', async () => {
    vi.useFakeTimers();

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
    useDashboardStore.getState().enterRoomZoom('kitchen', { x: 0, y: 0, scale: 2 });

    render(<RoomZoomCanvas />);

    // Both SVG instances should exist with distinct IDs.
    expect(document.getElementById('floorplan-svg')).toBeTruthy();
    expect(document.getElementById('minimap-floorplan-svg')).toBeTruthy();

    const exitButton = screen.getByRole('button', { name: 'Exit room view' });
    fireEvent.click(exitButton);

    await act(async () => {
      vi.advanceTimersByTime(ROOM_ZOOM_TRANSITION_MS);
    });

    expect(useDashboardStore.getState().roomZoom.mode).toBe('none');
  });
});
