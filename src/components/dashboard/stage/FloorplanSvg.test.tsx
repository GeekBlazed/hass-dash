import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FloorplanModel } from '../../../features/model/floorplan';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { FloorplanSvg } from './FloorplanSvg';

type ResizeObserverCallback = (entries: Array<ResizeObserverEntry>) => void;

class MockResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('FloorplanSvg', () => {
  beforeEach(() => {
    // Ensure consistent baseline state between tests.
    useDashboardStore.setState({
      activePanel: 'climate',
      isMapControlsOpen: false,
      stageView: { x: 0, y: 0, scale: 1 },
      floorplan: { state: 'idle', model: null, errorMessage: null },
    });

    // jsdom doesn't provide ResizeObserver; FloorplanSvg uses it for sizing.
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver;

    // jsdom doesn't define SVGTextElement/SVGCircleElement in this environment.
    // FloorplanSvg only uses these for instanceof checks during sizing.
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

  it('renders a fallback viewBox when no floorplan model is loaded', () => {
    render(<FloorplanSvg />);

    const svg = document.getElementById('floorplan-svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 10 10');
    expect(svg?.getAttribute('data-base-viewbox')).toBeNull();
  });

  it('initializes stageView from YAML initialView when stage is default', async () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          initialView: { scale: 2, x: 1, y: 2 },
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

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const stageView = useDashboardStore.getState().stageView;
    expect(stageView.scale).toBe(2);
    expect(stageView.x).toBe(1);
    expect(stageView.y).toBe(2);

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();

    // When a model is loaded, the component should expose the base viewBox.
    expect(svg?.getAttribute('data-base-viewbox')).toBe('-1.25 -1.25 12.5 12.5');
  });

  it('does not override stageView when it is already non-default', async () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          initialView: { scale: 2, x: 1, y: 2 },
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

    useDashboardStore.setState({ stageView: { x: 5, y: 6, scale: 1.1 } });
    useDashboardStore.getState().setFloorplanLoaded(model);

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const stageView = useDashboardStore.getState().stageView;
    expect(stageView.x).toBe(5);
    expect(stageView.y).toBe(6);
    expect(stageView.scale).toBe(1.1);
  });

  it('centers the initial view when YAML x/y are not finite', async () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          initialView: { scale: 2, x: Number.NaN, y: Number.NaN },
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

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const stageView = useDashboardStore.getState().stageView;
    expect(stageView.scale).toBe(2);
    expect(stageView.x).toBeCloseTo(1.875);
    expect(stageView.y).toBeCloseTo(1.875);
  });

  it('zooms on wheel by updating stageView.scale', async () => {
    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          initialView: { scale: 2, x: 0, y: 0 },
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

    const rectSpy = vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;
    expect(svg).toBeTruthy();

    const beforeScale = useDashboardStore.getState().stageView.scale;

    // Dispatch a wheel event (deltaY < 0 => zoom in).
    fireEvent.wheel(svg, { deltaY: -100, clientX: 50, clientY: 50 });

    await act(async () => {
      await Promise.resolve();
    });

    const afterScale = useDashboardStore.getState().stageView.scale;
    expect(afterScale).toBeGreaterThan(beforeScale);

    rectSpy.mockRestore();
  });

  it('suppresses the first room click immediately after a drag', async () => {
    vi.useFakeTimers();

    const model: FloorplanModel = {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
          initialView: { scale: 1, x: 0, y: 0 },
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

    const rectSpy = vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;

    // Simulate a mouse drag (move > 4px threshold).
    act(() => {
      svg.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );

      svg.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );

      svg.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );
    });

    const roomButton = screen.getByRole('button', { name: 'Kitchen' });

    // First click should be suppressed.
    fireEvent.click(roomButton);
    expect(roomButton.getAttribute('class') ?? '').not.toContain('is-active');

    // After timers flush, the click should be accepted.
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    fireEvent.click(roomButton);
    expect(roomButton.getAttribute('class') ?? '').toContain('is-active');

    rectSpy.mockRestore();
    vi.useRealTimers();
  });

  it('activates a room via keyboard (Enter and Space)', async () => {
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
    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const roomButton = screen.getByRole('button', { name: 'Kitchen' });
    fireEvent.keyDown(roomButton, { key: 'Enter' });
    expect(roomButton.getAttribute('class') ?? '').toContain('is-active');

    // Activate again via space (covers alternate key path).
    fireEvent.keyDown(roomButton, { key: ' ' });
    expect(roomButton.getAttribute('class') ?? '').toContain('is-active');
  });

  it('ignores pointer handling when interacting with .light-toggle elements', async () => {
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

    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;

    // Let the initial stageView settle (the component may auto-center on mount).
    const before = useDashboardStore.getState().stageView;

    const lightToggle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    lightToggle.setAttribute('class', 'light-toggle');
    svg.appendChild(lightToggle);

    act(() => {
      lightToggle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 10,
          clientY: 10,
        })
      );

      lightToggle.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );

      lightToggle.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          clientX: 30,
          clientY: 10,
        })
      );
    });

    expect(svg.getAttribute('class') ?? '').not.toContain('is-panning');
    const after = useDashboardStore.getState().stageView;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(after.scale).toBe(before.scale);
  });

  it('supports two-finger pinch zoom and suppresses the next room click', async () => {
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

    const rectSpy = vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      toJSON: () => ({}),
    } as DOMRect);

    render(<FloorplanSvg />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;

    // Start a pinch gesture.
    act(() => {
      svg.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 1,
          pointerType: 'touch',
          clientX: 10,
          clientY: 10,
        })
      );

      svg.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId: 2,
          pointerType: 'touch',
          clientX: 20,
          clientY: 10,
        })
      );
    });

    // Move one finger further away to zoom in.
    act(() => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerId: 2,
          pointerType: 'touch',
          clientX: 40,
          clientY: 10,
        })
      );
    });

    expect(useDashboardStore.getState().stageView.scale).toBeGreaterThan(1);

    // End the gesture (should set suppression flag).
    act(() => {
      svg.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          pointerId: 2,
          pointerType: 'touch',
          clientX: 40,
          clientY: 10,
        })
      );
    });

    const roomButton = screen.getByRole('button', { name: 'Kitchen' });
    fireEvent.click(roomButton);
    expect(roomButton.getAttribute('class') ?? '').not.toContain('is-active');

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    fireEvent.click(roomButton);

    rectSpy.mockRestore();
    vi.useRealTimers();
  });
});
