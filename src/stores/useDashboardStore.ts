import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { FloorplanModel } from '../features/model/floorplan';

export type DashboardPanel = 'agenda' | 'climate' | 'lighting' | 'media' | null;

export interface StageView {
  x: number;
  y: number;
  scale: number;
}

export type FloorplanLoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface DashboardState {
  activePanel: DashboardPanel;
  setActivePanel: (panel: DashboardPanel) => void;

  isMapControlsOpen: boolean;
  setMapControlsOpen: (open: boolean) => void;

  stageView: StageView;
  setStageView: (view: Partial<StageView>) => void;
  resetStageView: () => void;

  floorplan: {
    state: FloorplanLoadState;
    model: FloorplanModel | null;
    errorMessage: string | null;
  };
  setFloorplanLoading: () => void;
  setFloorplanLoaded: (model: FloorplanModel) => void;
  setFloorplanError: (message: string) => void;
}

const DEFAULT_STAGE_VIEW: StageView = {
  x: 0,
  y: 0,
  scale: 1,
};

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
        version: 1,
        partialize: (state) => ({
          activePanel: state.activePanel,
          isMapControlsOpen: state.isMapControlsOpen,
          stageView: state.stageView,
          floorplan: state.floorplan,
        }),
      }
    ),
    {
      name: 'hass-dash:dashboard',
    }
  )
);
