import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type DashboardPanel = 'agenda' | 'climate' | 'lighting' | 'media' | null;

export interface StageView {
  x: number;
  y: number;
  scale: number;
}

export interface LocalLightState {
  id: string;
  name?: string;
  state: 'on' | 'off';
  brightness?: number;
  colorTemp?: number;
}

export interface LocalThermostatState {
  setTemperature?: number;
  hvacMode?: string;
  fanMode?: string;
  measuredTemperature?: number;
  measuredHumidity?: number;
}

export interface LocalAreaClimateState {
  areaId: string;
  temp?: number;
  humidity?: number | null;
}

export interface LocalLightingModel {
  lights: Record<string, LocalLightState>;
}

export interface LocalClimateModel {
  thermostat: LocalThermostatState;
  areas: Record<string, LocalAreaClimateState>;
}

interface DashboardState {
  activePanel: DashboardPanel;
  setActivePanel: (panel: DashboardPanel) => void;

  stageView: StageView;
  setStageView: (view: Partial<StageView>) => void;
  resetStageView: () => void;

  // Local-only prototype models (while HA is not integrated)
  lighting: LocalLightingModel;
  setLightState: (lightId: string, next: Partial<Omit<LocalLightState, 'id'>>) => void;
  setLightOn: (lightId: string, on: boolean) => void;
  clearLighting: () => void;

  climate: LocalClimateModel;
  setThermostat: (next: Partial<LocalThermostatState>) => void;
  setAreaClimate: (areaId: string, next: Partial<Omit<LocalAreaClimateState, 'areaId'>>) => void;
  clearClimate: () => void;
}

const DEFAULT_STAGE_VIEW: StageView = {
  x: 0,
  y: 0,
  scale: 1,
};

const DEFAULT_LIGHTING: LocalLightingModel = {
  lights: {},
};

const DEFAULT_CLIMATE: LocalClimateModel = {
  thermostat: {},
  areas: {},
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set) => ({
        activePanel: 'climate',
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

        lighting: DEFAULT_LIGHTING,
        setLightState: (lightId, next) => {
          set((state) =>
            produce(state, (draft) => {
              const existing: LocalLightState =
                draft.lighting.lights[lightId] ??
                ({ id: lightId, state: 'off' } satisfies LocalLightState);
              draft.lighting.lights[lightId] = { ...existing, ...next };
            })
          );
        },
        setLightOn: (lightId, on) => {
          set((state) =>
            produce(state, (draft) => {
              const existing: LocalLightState =
                draft.lighting.lights[lightId] ??
                ({ id: lightId, state: 'off' } satisfies LocalLightState);
              existing.state = on ? 'on' : 'off';
              draft.lighting.lights[lightId] = existing;
            })
          );
        },
        clearLighting: () => {
          set({ lighting: DEFAULT_LIGHTING });
        },

        climate: DEFAULT_CLIMATE,
        setThermostat: (next) => {
          set((state) =>
            produce(state, (draft) => {
              draft.climate.thermostat = { ...draft.climate.thermostat, ...next };
            })
          );
        },
        setAreaClimate: (areaId, next) => {
          set((state) =>
            produce(state, (draft) => {
              const existing: LocalAreaClimateState =
                draft.climate.areas[areaId] ?? ({ areaId } satisfies LocalAreaClimateState);
              draft.climate.areas[areaId] = { ...existing, ...next };
            })
          );
        },
        clearClimate: () => {
          set({ climate: DEFAULT_CLIMATE });
        },
      }),
      {
        name: 'hass-dash:dashboard',
        version: 1,
        partialize: (state) => ({
          activePanel: state.activePanel,
          stageView: state.stageView,
          lighting: state.lighting,
          climate: state.climate,
        }),
      }
    ),
    {
      name: 'hass-dash:dashboard',
    }
  )
);
