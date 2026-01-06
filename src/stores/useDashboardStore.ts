import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type DashboardPanel = 'agenda' | 'climate' | 'lighting' | 'media' | null;

export interface StageView {
  x: number;
  y: number;
  scale: number;
}

interface DashboardState {
  activePanel: DashboardPanel;
  setActivePanel: (panel: DashboardPanel) => void;

  stageView: StageView;
  setStageView: (view: Partial<StageView>) => void;
  resetStageView: () => void;
}

const DEFAULT_STAGE_VIEW: StageView = {
  x: 0,
  y: 0,
  scale: 1,
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set) => ({
        activePanel: null,
        setActivePanel: (panel) => {
          set({ activePanel: panel });
        },

        stageView: DEFAULT_STAGE_VIEW,
        setStageView: (view) => {
          set((state) =>
            produce(state, (draft) => {
              draft.stageView = { ...draft.stageView, ...view };
            })
          );
        },
        resetStageView: () => {
          set({ stageView: DEFAULT_STAGE_VIEW });
        },
      }),
      {
        name: 'hass-dash:dashboard',
        version: 1,
        partialize: (state) => ({
          activePanel: state.activePanel,
          stageView: state.stageView,
        }),
      }
    ),
    {
      name: 'hass-dash:dashboard',
    }
  )
);
