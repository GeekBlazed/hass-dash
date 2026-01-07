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

// Shared store mock used by the selector shim.
const mockStore = {
  setFloorplanLoading: vi.fn(),
  setFloorplanLoaded: vi.fn(),
  setFloorplanError: vi.fn(),
  setClimateModel: vi.fn(),
  setLightingModel: vi.fn(),
};

const useServiceMock = vi.mocked(useService);

describe('DashboardShell', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useServiceMock.mockReset();

    mockStore.setFloorplanLoading.mockReset();
    mockStore.setFloorplanLoaded.mockReset();
    mockStore.setFloorplanError.mockReset();
    mockStore.setClimateModel.mockReset();
    mockStore.setLightingModel.mockReset();

    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports an error when fetch is unavailable', () => {
    // @ts-expect-error intentional for test
    globalThis.fetch = undefined;

    useServiceMock.mockReturnValue({
      getFloorplan: vi.fn(),
      getClimate: vi.fn(),
      getLighting: vi.fn(),
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
    const climateSource = {
      getClimate: vi.fn().mockResolvedValue({}),
    };
    const lightingSource = {
      getLighting: vi.fn().mockResolvedValue({}),
    };

    useServiceMock
      .mockReturnValueOnce(floorplanSource)
      .mockReturnValueOnce(climateSource)
      .mockReturnValueOnce(lightingSource);

    render(<DashboardShell />);

    expect(mockStore.setFloorplanLoading).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockStore.setFloorplanError).toHaveBeenCalledWith('floorplan exploded');
    });

    expect(mockStore.setClimateModel).toHaveBeenCalled();
    expect(mockStore.setLightingModel).toHaveBeenCalled();
  });

  it('uses a generic floorplan error when rejection reason is not an Error', async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const floorplanSource = {
      getFloorplan: vi.fn().mockRejectedValue('nope'),
    };
    const climateSource = {
      getClimate: vi.fn().mockResolvedValue({}),
    };
    const lightingSource = {
      getLighting: vi.fn().mockResolvedValue({}),
    };

    useServiceMock
      .mockReturnValueOnce(floorplanSource)
      .mockReturnValueOnce(climateSource)
      .mockReturnValueOnce(lightingSource);

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
    const climateSource = {
      getClimate: vi.fn().mockReturnValue(floorplanPromise),
    };
    const lightingSource = {
      getLighting: vi.fn().mockReturnValue(floorplanPromise),
    };

    useServiceMock
      .mockReturnValueOnce(floorplanSource)
      .mockReturnValueOnce(climateSource)
      .mockReturnValueOnce(lightingSource);

    const { unmount } = render(<DashboardShell />);
    unmount();

    resolveFloorplan?.({});

    // Let Promise.allSettled resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(mockStore.setFloorplanLoaded).not.toHaveBeenCalled();
    expect(mockStore.setFloorplanError).not.toHaveBeenCalled();
    expect(mockStore.setClimateModel).not.toHaveBeenCalled();
    expect(mockStore.setLightingModel).not.toHaveBeenCalled();
  });
});
