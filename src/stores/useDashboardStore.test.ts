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

  it('can enable/disable and toggle overlays', () => {
    const state = useDashboardStore.getState();

    expect(state.overlays.tracking).toBe(true);
    expect(state.overlays.climate).toBe(true);
    expect(state.overlays.lighting).toBe(false);

    state.setOverlayEnabled('lighting', true);
    expect(useDashboardStore.getState().overlays.lighting).toBe(true);

    state.toggleOverlay('lighting');
    expect(useDashboardStore.getState().overlays.lighting).toBe(false);
  });

  it('can set stage font/icon scales', () => {
    const state = useDashboardStore.getState();

    state.setStageFontScale(1.25);
    state.setStageIconScale(0.75);

    expect(useDashboardStore.getState().stageFontScale).toBe(1.25);
    expect(useDashboardStore.getState().stageIconScale).toBe(0.75);
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

  it('migrate() preserves null persisted state', () => {
    const options = useDashboardStore.persist.getOptions();
    const migrate = options.migrate as unknown as (persistedState: unknown) => unknown;

    // Covers: if (!s) return persistedState
    expect(migrate(null)).toBeNull();
  });

  it('migrate() normalizes overlays and stage scales', () => {
    const options = useDashboardStore.persist.getOptions();
    const migrate = options.migrate as unknown as (persistedState: unknown) => {
      overlays?: Record<string, unknown>;
      stageFontScale?: unknown;
      stageIconScale?: unknown;
    };

    // Covers: overlays normalization + finite/non-finite branches.
    const migrated = migrate({
      overlays: { lighting: true },
      stageFontScale: 2,
      stageIconScale: Number.NaN,
    });

    expect(migrated.overlays).toEqual({
      tracking: true,
      climate: true,
      lighting: true,
    });
    expect(migrated.stageFontScale).toBe(2);
    expect(migrated.stageIconScale).toBe(1);

    // Covers: overlays undefined fallback.
    const migratedDefaults = migrate({
      overlays: undefined,
      stageFontScale: undefined,
      stageIconScale: undefined,
    });

    expect(migratedDefaults.overlays).toEqual({
      tracking: true,
      climate: true,
      lighting: false,
    });
  });
});
