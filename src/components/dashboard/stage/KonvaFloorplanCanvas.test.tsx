import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import KonvaFloorplanCanvas from './KonvaFloorplanCanvas';

type StageProps = Record<string, unknown>;
type LineProps = Record<string, unknown>;

type DashboardStoreMock = {
  floorplan: { model: unknown };
  stageView: { x: number; y: number; scale: number };
  setStageView: ReturnType<typeof vi.fn>;
  resetStageView: ReturnType<typeof vi.fn>;
};

const stageState: { lastProps: StageProps | null; lineProps: LineProps[] } = {
  lastProps: null,
  lineProps: [],
};

const mockStore: DashboardStoreMock = {
  floorplan: {
    model: {
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          initialView: { scale: 2, x: 10, y: 20 },
          rooms: [
            {
              id: 'living',
              name: 'Living Room',
              points: [
                [0, 0],
                [5, 0],
                [5, 5],
                [0, 5],
              ],
            },
          ],
        },
      ],
    },
  },
  stageView: { x: 0, y: 0, scale: 1 },
  setStageView: vi.fn(),
  resetStageView: vi.fn(),
};

vi.mock('../../../stores/useDashboardStore', () => ({
  useDashboardStore: (selector: (s: DashboardStoreMock) => unknown) => selector(mockStore),
}));

vi.mock('react-konva', () => ({
  Stage: (props: StageProps) => {
    stageState.lastProps = props;
    return <div data-testid="konva-stage" />;
  },
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Rect: () => <div data-testid="konva-rect" />,
  Text: ({ text }: { text?: string }) => <span>{text}</span>,
  Line: (props: LineProps) => {
    stageState.lineProps.push(props);
    return <button type="button">line</button>;
  },
}));

describe('KonvaFloorplanCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stageState.lastProps = null;
    stageState.lineProps = [];

    mockStore.stageView = { x: 0, y: 0, scale: 1 };

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 800,
        height: 600,
        bottom: 600,
        right: 800,
        toJSON: () => ({}),
      }),
    });
  });

  it('initializes from floor initial view and handles keyboard controls', () => {
    render(<KonvaFloorplanCanvas />);

    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
    expect(mockStore.setStageView).toHaveBeenCalledWith({ x: 10, y: 20, scale: 2 });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
    expect(mockStore.resetStageView).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '=' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

    expect(mockStore.setStageView.mock.calls.length).toBeGreaterThan(3);
  });

  it('ignores keyboard pan/zoom when text input is focused', () => {
    render(<KonvaFloorplanCanvas />);
    mockStore.setStageView.mockClear();

    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(mockStore.setStageView).not.toHaveBeenCalled();
  });

  it('handles wheel and drag interactions', () => {
    render(<KonvaFloorplanCanvas />);

    const props = stageState.lastProps as {
      onWheel?: (evt: unknown) => void;
      onMouseDown?: (evt: unknown) => void;
      onMouseMove?: (evt: unknown) => void;
      onMouseUp?: () => void;
      onMouseLeave?: () => void;
    };

    expect(props).toBeTruthy();

    mockStore.setStageView.mockClear();

    props.onWheel?.({
      evt: { deltaY: 120, preventDefault: vi.fn() },
      target: { getStage: () => ({ getPointerPosition: () => null }) },
    });
    expect(mockStore.setStageView).not.toHaveBeenCalled();

    props.onWheel?.({
      evt: { deltaY: -80, preventDefault: vi.fn() },
      target: { getStage: () => ({ getPointerPosition: () => ({ x: 20, y: 30 }) }) },
    });
    expect(mockStore.setStageView).toHaveBeenCalled();

    mockStore.setStageView.mockClear();
    props.onMouseDown?.({ evt: { button: 1, clientX: 0, clientY: 0 } });
    props.onMouseMove?.({ evt: { clientX: 10, clientY: 10 } });
    expect(mockStore.setStageView).not.toHaveBeenCalled();

    props.onMouseDown?.({ evt: { button: 0, clientX: 10, clientY: 10 } });
    props.onMouseMove?.({ evt: { clientX: 30, clientY: 45 } });
    expect(mockStore.setStageView).toHaveBeenCalled();

    props.onMouseUp?.();
    props.onMouseLeave?.();
  });

  it('does not initialize stage view when a non-default stage is already persisted', () => {
    mockStore.stageView = { x: 100, y: 100, scale: 1.4 };

    render(<KonvaFloorplanCanvas />);

    expect(mockStore.setStageView).not.toHaveBeenCalledWith({ x: 10, y: 20, scale: 2 });
  });
});
