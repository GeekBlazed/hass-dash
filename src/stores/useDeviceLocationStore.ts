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
