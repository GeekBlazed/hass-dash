import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { FloorplanModel } from '../features/model/floorplan';

export type DashboardPanel = 'agenda' | 'climate' | 'lighting' | 'media' | null;

export type DashboardOverlay = 'tracking' | 'climate' | 'lighting';

export interface StageView {
  x: number;
  y: number;
  scale: number;
}

export type FloorplanLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface DashboardState {
  activePanel: DashboardPanel;
  setActivePanel: (panel: DashboardPanel) => void;

  overlays: Record<DashboardOverlay, boolean>;
  setOverlayEnabled: (overlay: DashboardOverlay, enabled: boolean) => void;
  toggleOverlay: (overlay: DashboardOverlay) => void;

  isMapControlsOpen: boolean;
  setMapControlsOpen: (open: boolean) => void;

  stageView: StageView;
  setStageView: (view: Partial<StageView>) => void;
  resetStageView: () => void;

  stageFontScale: number;
  setStageFontScale: (scale: number) => void;

  floorplan: {
    state: FloorplanLoadState;
    model: FloorplanModel | null;
    errorMessage: string | null;
  };
  setFloorplanLoading: () => void;
  setFloorplanLoaded: (model: FloorplanModel) => void;
  setFloorplanError: (message: string) => void;
}

const DEFAULT_OVERLAYS: Record<DashboardOverlay, boolean> = {
  tracking: true,
  climate: true,
  lighting: false,
};

const normalizeOverlays = (
  overlays: Partial<Record<DashboardOverlay, boolean>> | undefined
): Record<DashboardOverlay, boolean> => {
  return {
    ...DEFAULT_OVERLAYS,
    ...(overlays ?? {}),
  };
};

const DEFAULT_STAGE_VIEW: StageView = {
  x: 0,
  y: 0,
  scale: 1,
};

const DEFAULT_STAGE_FONT_SCALE = 1;

const DEFAULT_FLOORPLAN: DashboardState['floorplan'] = {
  state: 'idle',
  model: null,
  errorMessage: null,
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set) => ({
        activePanel: 'climate',
        setActivePanel: (panel) => {
          set({ activePanel: panel });
        },

        overlays: DEFAULT_OVERLAYS,
        setOverlayEnabled: (overlay, enabled) => {
          set((state) => ({
            overlays: {
              ...state.overlays,
              [overlay]: enabled,
            },
          }));
        },
        toggleOverlay: (overlay) => {
          set((state) => ({
            overlays: {
              ...state.overlays,
              [overlay]: !state.overlays[overlay],
            },
          }));
        },

        isMapControlsOpen: false,
        setMapControlsOpen: (open) => {
          set({ isMapControlsOpen: open });
        },

        stageView: DEFAULT_STAGE_VIEW,
        setStageView: (view) => {
          set((state) => ({
            stageView: { ...state.stageView, ...view },
          }));
        },
        resetStageView: () => {
          set({ stageView: DEFAULT_STAGE_VIEW });
        },

        stageFontScale: DEFAULT_STAGE_FONT_SCALE,
        setStageFontScale: (scale) => {
          set({ stageFontScale: scale });
        },

        floorplan: DEFAULT_FLOORPLAN,
        setFloorplanLoading: () => {
          set({
            floorplan: {
              state: 'loading',
              model: null,
              errorMessage: null,
            },
          });
        },
        setFloorplanLoaded: (model) => {
          set({
            floorplan: {
              state: 'loaded',
              model,
              errorMessage: null,
            },
          });
        },
        setFloorplanError: (message) => {
          set({
            floorplan: {
              state: 'error',
              model: null,
              errorMessage: message,
            },
          });
        },
      }),
      {
        name: 'hass-dash:dashboard',
        // v2 schema: introduce/normalize the `overlays` field in persisted dashboard state.
        // The migrate function backfills a valid overlays map for users with pre-v2 data
        // and ensures all known DashboardOverlay keys are present with boolean values.
        version: 3,
        migrate: (persistedState) => {
          const s = persistedState as Partial<DashboardState> | null;
          if (!s) return persistedState as DashboardState;

          return {
            ...s,
            overlays: normalizeOverlays(s.overlays as Partial<Record<DashboardOverlay, boolean>>),
            stageFontScale:
              typeof s.stageFontScale === 'number' && Number.isFinite(s.stageFontScale)
                ? s.stageFontScale
                : DEFAULT_STAGE_FONT_SCALE,
          } as DashboardState;
        },
        partialize: (state) => ({
          activePanel: state.activePanel,
          overlays: state.overlays,
          isMapControlsOpen: state.isMapControlsOpen,
          stageView: state.stageView,
          stageFontScale: state.stageFontScale,
          floorplan: state.floorplan,
        }),
      }
    ),
    {
      name: 'hass-dash:dashboard',
    }
  )
);
