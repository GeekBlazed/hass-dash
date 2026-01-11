import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface DeviceLocation {
  position: {
    x: number;
    y: number;
    z?: number;
  };

  geo?: {
    latitude: number;
    longitude: number;
    elevation?: number;
  };

  confidence: number;
  lastSeen: string | undefined;
  receivedAt: number;
}

interface DeviceLocationStore {
  locationsByEntityId: Record<string, DeviceLocation>;

  upsert: (entityId: string, location: DeviceLocation) => void;
  remove: (entityId: string) => void;
  pruneToEntityIds: (entityIds: Iterable<string>) => void;
  clear: () => void;
}

export const useDeviceLocationStore = create<DeviceLocationStore>()(
  devtools(
    persist(
      (set) => ({
        locationsByEntityId: {},

        upsert: (entityId, location) => {
          set((state) =>
            produce(state, (draft) => {
              draft.locationsByEntityId[entityId] = location;
            })
          );
        },

        remove: (entityId) => {
          set((state) =>
            produce(state, (draft) => {
              delete draft.locationsByEntityId[entityId];
            })
          );
        },

        pruneToEntityIds: (entityIds) => {
          const allowed = new Set(entityIds);
          set((state) =>
            produce(state, (draft) => {
              for (const id of Object.keys(draft.locationsByEntityId)) {
                if (!allowed.has(id)) {
                  delete draft.locationsByEntityId[id];
                }
              }
            })
          );
        },

        clear: () => {
          set({ locationsByEntityId: {} });
        },
      }),
      {
        name: 'hass-dash:device-locations',
        version: 1,
        partialize: (state) => ({
          locationsByEntityId: state.locationsByEntityId,
        }),
      }
    )
  )
);
