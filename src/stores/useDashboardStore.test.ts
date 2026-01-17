import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from './useDashboardStore';

const createInitialDashboardState = () => ({
  activePanel: 'climate' as const,
  isMapControlsOpen: false,
  stageView: { x: 0, y: 0, scale: 1 },
  floorplan: { state: 'idle' as const, model: null, errorMessage: null },
});

const resetDashboardStore = () => {
  useDashboardStore.persist.clearStorage();
  useDashboardStore.setState(createInitialDashboardState());
};

describe('useDashboardStore', () => {
  beforeEach(() => {
    resetDashboardStore();
  });

  it('defaults to climate panel', () => {
    expect(useDashboardStore.getState().activePanel).toBe('climate');
  });

  it('can set active panel', () => {
    useDashboardStore.getState().setActivePanel('lighting');
    expect(useDashboardStore.getState().activePanel).toBe('lighting');
  });

  it('can update stage view partially', () => {
    useDashboardStore.getState().setStageView({ scale: 2 });
    expect(useDashboardStore.getState().stageView).toEqual({ x: 0, y: 0, scale: 2 });
  });

  it('can reset stage view', () => {
    useDashboardStore.getState().setStageView({ x: 12, y: 34, scale: 1.5 });
    useDashboardStore.getState().resetStageView();

    expect(useDashboardStore.getState().stageView).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it('can toggle map controls open/closed', () => {
    useDashboardStore.getState().setMapControlsOpen(true);
    expect(useDashboardStore.getState().isMapControlsOpen).toBe(true);

    useDashboardStore.getState().setMapControlsOpen(false);
    expect(useDashboardStore.getState().isMapControlsOpen).toBe(false);
  });

  it('can set floorplan loading state', () => {
    useDashboardStore.getState().setFloorplanLoading();
    expect(useDashboardStore.getState().floorplan).toEqual({
      state: 'loading',
      model: null,
      errorMessage: null,
    });
  });

  it('can set floorplan error state', () => {
    useDashboardStore.getState().setFloorplanError('nope');
    expect(useDashboardStore.getState().floorplan).toEqual({
      state: 'error',
      model: null,
      errorMessage: 'nope',
    });
  });
});
