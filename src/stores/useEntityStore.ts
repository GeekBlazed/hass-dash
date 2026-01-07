import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { HaEntityState } from '../types/home-assistant';

interface EntityStateStore {
  entitiesById: Record<string, HaEntityState>;
  lastUpdatedAt: number | null;

  setAll: (states: HaEntityState[]) => void;
  upsert: (state: HaEntityState) => void;
  clear: () => void;
}

export const useEntityStore = create<EntityStateStore>()(
  devtools(
    persist(
      (set) => ({
        entitiesById: {},
        lastUpdatedAt: null,

        setAll: (states) => {
          set({
            entitiesById: Object.fromEntries(states.map((s) => [s.entity_id, s])),
            lastUpdatedAt: Date.now(),
          });
        },

        upsert: (entityState) => {
          set((state) =>
            produce(state, (draft) => {
              draft.entitiesById[entityState.entity_id] = entityState;
              draft.lastUpdatedAt = Date.now();
            })
          );
        },

        clear: () => {
          set({ entitiesById: {}, lastUpdatedAt: null });
        },
      }),
      {
        name: 'hass-dash:entities',
        version: 1,
        partialize: (state) => ({
          entitiesById: state.entitiesById,
          lastUpdatedAt: state.lastUpdatedAt,
        }),
      }
    )
  )
);
