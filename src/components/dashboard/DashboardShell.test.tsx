import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useService } from '../../hooks/useService';
import { DashboardShell } from './DashboardShell';

vi.mock('../../hooks/useService', () => {
  return {
    useService: vi.fn(),
  };
});

vi.mock('../../stores/useDashboardStore', () => {
  return {
    useDashboardStore: (selector: (s: unknown) => unknown) => selector(mockStore),
  };
});

vi.mock('./DashboardSidebar', () => ({
  DashboardSidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('./DashboardStage', () => ({
  DashboardStage: () => <div data-testid="stage" />,
}));

vi.mock('./HaLightHotwireBridge', () => ({
  HaLightHotwireBridge: () => null,
}));

vi.mock('./ConnectivityController', () => ({
  ConnectivityController: () => null,
}));

vi.mock('./HaAreaClimateOverlayBridge', () => ({
  HaAreaClimateOverlayBridge: () => null,
}));

vi.mock('./DeviceLocationTrackingController', () => ({
  DeviceLocationTrackingController: () => null,
}));

// Shared store mock used by the selector shim.
const mockStore = {
  setFloorplanLoading: vi.fn(),
  setFloorplanLoaded: vi.fn(),
  setFloorplanError: vi.fn(),
};

const useServiceMock = vi.mocked(useService);

describe('DashboardShell', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useServiceMock.mockReset();

    mockStore.setFloorplanLoading.mockReset();
    mockStore.setFloorplanLoaded.mockReset();
    mockStore.setFloorplanError.mockReset();

    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;

    vi.unstubAllEnvs();
  });

  it("does not apply no-virtual-panel when env var isn't false", () => {
    vi.stubEnv('VITE_FEATURE_SHOW_VIRTUAL_PANEL', 'true');
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    useServiceMock.mockReturnValue({
      getFloorplan: vi.fn().mockResolvedValue({}),
    });

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { container } = render(<DashboardShell />);
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root).toHaveClass('viewport');
    expect(root).not.toHaveClass('no-virtual-panel');

    consoleInfoSpy.mockRestore();
  });

  it('applies no-virtual-panel when explicitly disabled (env var false)', () => {
    vi.stubEnv('VITE_FEATURE_SHOW_VIRTUAL_PANEL', 'false');
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    useServiceMock.mockReturnValue({
      getFloorplan: vi.fn().mockResolvedValue({}),
    });

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { container } = render(<DashboardShell />);
    const root = container.firstElementChild;

    expect(root).not.toBeNull();
    expect(root).toHaveClass('viewport');
    expect(root).toHaveClass('no-virtual-panel');

    consoleInfoSpy.mockRestore();
  });

  it('reports an error when fetch is unavailable', () => {
    // @ts-expect-error intentional for test
    globalThis.fetch = undefined;

    useServiceMock.mockReturnValue({
      getFloorplan: vi.fn(),
    });

    render(<DashboardShell />);

    expect(mockStore.setFloorplanError).toHaveBeenCalledWith(
      'Fetch API is not available in this environment.'
    );
  });

  it('sets floorplan error from Error reason when floorplan load fails', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const floorplanSource = {
      getFloorplan: vi.fn().mockRejectedValue(new Error('floorplan exploded')),
    };
    useServiceMock.mockReturnValueOnce(floorplanSource);

    render(<DashboardShell />);

    expect(mockStore.setFloorplanLoading).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockStore.setFloorplanError).toHaveBeenCalledWith('floorplan exploded');
    });
  });

  it('uses a generic floorplan error when rejection reason is not an Error', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const floorplanSource = {
      getFloorplan: vi.fn().mockRejectedValue('nope'),
    };
    useServiceMock.mockReturnValueOnce(floorplanSource);

    render(<DashboardShell />);

    await waitFor(() => {
      expect(mockStore.setFloorplanError).toHaveBeenCalledWith('Failed to load floorplan.');
    });
  });

  it('does not update store after unmount (disposed guard)', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    let resolveFloorplan: ((value: unknown | PromiseLike<unknown>) => void) | undefined;
    const floorplanPromise = new Promise<unknown>((resolve) => {
      resolveFloorplan = resolve;
    });

    const floorplanSource = {
      getFloorplan: vi.fn().mockReturnValue(floorplanPromise),
    };
    useServiceMock.mockReturnValueOnce(floorplanSource);

    const { unmount } = render(<DashboardShell />);
    unmount();

    resolveFloorplan?.({});

    // Let Promise.allSettled resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockStore.setFloorplanLoaded).not.toHaveBeenCalled();
    expect(mockStore.setFloorplanError).not.toHaveBeenCalled();
  });
});
