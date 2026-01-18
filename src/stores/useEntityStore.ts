import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { HaEntityState } from '../types/home-assistant';

const MAX_PERSISTED_ENTITIES = 250;

const limitPersistedEntities = (
  entitiesById: Record<string, HaEntityState>
): Record<string, HaEntityState> => {
  const entries = Object.entries(entitiesById);
  if (entries.length <= MAX_PERSISTED_ENTITIES) return entitiesById;

  // Keep the most recently updated entities to maximize usefulness of LKG on reload.
  entries.sort(([, a], [, b]) => {
    const aStamp = a.last_updated;
    const bStamp = b.last_updated;
    // ISO-8601 timestamps sort lexicographically.
    // Descending: newest first.
    return bStamp.localeCompare(aStamp);
  });

  return Object.fromEntries(entries.slice(0, MAX_PERSISTED_ENTITIES));
};

interface EntityStateStore {
  entitiesById: Record<string, HaEntityState>;
  lastUpdatedAt: number | null;

  /**
   * Entity ids labeled "Household" in the Home Assistant entity registry.
   *
   * Stored as a Record for easy lookups and to avoid persisting potentially
   * large/volatile registry metadata.
   */
  householdEntityIds: Record<string, true>;

  setAll: (states: HaEntityState[]) => void;
  upsert: (state: HaEntityState) => void;
  upsertMany: (states: ReadonlyArray<HaEntityState>) => void;
  optimisticSetState: (entityId: string, nextState: string) => void;
  setHouseholdEntityIds: (entityIds: Iterable<string>) => void;
  clear: () => void;
}

export const useEntityStore = create<EntityStateStore>()(
  devtools(
    persist(
      (set) => ({
        entitiesById: {},
        lastUpdatedAt: null,
        householdEntityIds: {},

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

        upsertMany: (entityStates) => {
          if (entityStates.length === 0) return;

          set((state) =>
            produce(state, (draft) => {
              for (const entityState of entityStates) {
                draft.entitiesById[entityState.entity_id] = entityState;
              }
              draft.lastUpdatedAt = Date.now();
            })
          );
        },

        optimisticSetState: (entityId, nextState) => {
          const now = Date.now();
          const iso = new Date(now).toISOString();

          set((state) =>
            produce(state, (draft) => {
              const existing = draft.entitiesById[entityId];
              if (!existing) return;

              // Keep attributes/context, but reflect the new state immediately.
              existing.state = nextState;
              existing.last_changed = iso;
              existing.last_updated = iso;

              draft.lastUpdatedAt = now;
            })
          );
        },

        setHouseholdEntityIds: (entityIds) => {
          set({
            householdEntityIds: Object.fromEntries(Array.from(entityIds, (id) => [id, true])),
          });
        },

        clear: () => {
          set({ entitiesById: {}, lastUpdatedAt: null, householdEntityIds: {} });
        },
      }),
      {
        name: 'hass-dash:entities',
        version: 1,
        partialize: (state) => ({
          entitiesById: limitPersistedEntities(state.entitiesById),
          lastUpdatedAt: state.lastUpdatedAt,
        }),
      }
    )
  )
);
