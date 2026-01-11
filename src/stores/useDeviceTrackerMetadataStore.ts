import { create } from 'zustand';

import type { DeviceTrackerMetadata } from '../interfaces/IDeviceTrackerMetadataService';

export type DeviceTrackerMetadataState = {
  metadataByEntityId: Record<string, DeviceTrackerMetadata>;
  setAll: (metadataByEntityId: Record<string, DeviceTrackerMetadata>) => void;
  upsert: (entityId: string, metadata: Partial<DeviceTrackerMetadata>) => void;
  clear: () => void;
};

export const useDeviceTrackerMetadataStore = create<DeviceTrackerMetadataState>((set) => ({
  metadataByEntityId: {},
  setAll: (metadataByEntityId) => {
    set({ metadataByEntityId });
  },
  upsert: (entityId, metadata) => {
    set((state) => {
      const prev = state.metadataByEntityId[entityId] ?? {};

      // Treat `undefined` as "no update" so partial upserts cannot accidentally
      // erase values sourced from the HA registries.
      const filtered = Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => value !== undefined)
      ) as Partial<DeviceTrackerMetadata>;

      return {
        metadataByEntityId: {
          ...state.metadataByEntityId,
          [entityId]: {
            ...prev,
            ...filtered,
          },
        },
      };
    });
  },
  clear: () => {
    set({ metadataByEntityId: {} });
  },
}));
