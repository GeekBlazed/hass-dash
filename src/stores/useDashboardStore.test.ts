import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from './useDashboardStore';

describe('useDashboardStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useDashboardStore.persist.clearStorage();
    useDashboardStore.setState({
      activePanel: null,
      stageView: { x: 0, y: 0, scale: 1 },
    });
  });

  it('defaults to no active panel', () => {
    expect(useDashboardStore.getState().activePanel).toBeNull();
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
});
