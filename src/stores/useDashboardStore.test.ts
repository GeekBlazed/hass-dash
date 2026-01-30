import { beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from './useDashboardStore';

const createInitialDashboardState = () => ({
  activePanel: 'climate' as const,
  overlays: { tracking: true, climate: true, lighting: false } as const,
  isMapControlsOpen: false,
  stageView: { x: 0, y: 0, scale: 1 },
  stageFontScale: 1,
  stageIconScale: 1,
  roomZoom: {
    mode: 'none' as const,
    roomId: null,
    stageView: null,
    previousStageView: null,
    targetStageView: null,
  },
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

  it('defaults room zoom to none', () => {
    expect(useDashboardStore.getState().roomZoom).toEqual({
      mode: 'none',
      roomId: null,
      stageView: null,
      previousStageView: null,
      targetStageView: null,
    });
  });

  it('can enter and exit room zoom', () => {
    const state = useDashboardStore.getState();

    // Simulate a pre-zoom camera that is not the default.
    state.setStageView({ x: 10, y: 20, scale: 1.5 });

    state.enterRoomZoom('kitchen', { x: 1, y: 2, scale: 3 });
    expect(useDashboardStore.getState().roomZoom).toEqual({
      mode: 'entering',
      roomId: 'kitchen',
      stageView: { x: 10, y: 20, scale: 1.5 },
      previousStageView: { x: 10, y: 20, scale: 1.5 },
      targetStageView: { x: 1, y: 2, scale: 3 },
    });

    state.finishEnterRoomZoom();
    expect(useDashboardStore.getState().roomZoom).toEqual({
      mode: 'room',
      roomId: 'kitchen',
      stageView: { x: 1, y: 2, scale: 3 },
      previousStageView: { x: 10, y: 20, scale: 1.5 },
      targetStageView: null,
    });

    state.startExitRoomZoom();
    expect(useDashboardStore.getState().roomZoom).toEqual({
      mode: 'exiting',
      roomId: 'kitchen',
      stageView: { x: 1, y: 2, scale: 3 },
      previousStageView: { x: 10, y: 20, scale: 1.5 },
      targetStageView: { x: 10, y: 20, scale: 1.5 },
    });

    state.finishExitRoomZoom();
    expect(useDashboardStore.getState().roomZoom).toEqual({
      mode: 'none',
      roomId: null,
      stageView: null,
      previousStageView: null,
      targetStageView: null,
    });
  });

  it('does not allow room switching while zoomed', () => {
    const state = useDashboardStore.getState();

    state.enterRoomZoom('kitchen', { x: 1, y: 2, scale: 3 });
    state.enterRoomZoom('office', { x: 9, y: 8, scale: 7 });

    expect(useDashboardStore.getState().roomZoom.roomId).toBe('kitchen');
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
