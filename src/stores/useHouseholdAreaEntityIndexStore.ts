import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { HouseholdEntityKind } from '../interfaces/IHouseholdAreaEntityIndexService';

export type HouseholdEntityIdsByKind = Record<HouseholdEntityKind, Record<string, true>>;

interface HouseholdAreaEntityIndexState {
  areaNameById: Record<string, string | undefined>;

  householdDeviceIdsByAreaId: Record<string, Record<string, true>>;
  householdEntityIdsByAreaId: Record<string, HouseholdEntityIdsByKind>;

  setIndex: (params: {
    areaNameById: Record<string, string | undefined>;
    householdDeviceIdsByAreaId: Record<string, Iterable<string>>;
    householdEntityIdsByAreaId: Record<string, Record<HouseholdEntityKind, Iterable<string>>>;
  }) => void;

  clear: () => void;
}

const emptyByKind = (): HouseholdEntityIdsByKind => ({
  temperature: {},
  humidity: {},
  light: {},
});

export const useHouseholdAreaEntityIndexStore = create<HouseholdAreaEntityIndexState>()(
  devtools((set) => ({
    areaNameById: {},
    householdDeviceIdsByAreaId: {},
    householdEntityIdsByAreaId: {},

    setIndex: ({ areaNameById, householdDeviceIdsByAreaId, householdEntityIdsByAreaId }) => {
      const normalizedDeviceIdsByAreaId: Record<string, Record<string, true>> = Object.fromEntries(
        Object.entries(householdDeviceIdsByAreaId).map(([areaId, ids]) => [
          areaId,
          Object.fromEntries(Array.from(ids, (id) => [id, true])),
        ])
      );

      const normalizedEntityIdsByAreaId: Record<string, HouseholdEntityIdsByKind> =
        Object.fromEntries(
          Object.entries(householdEntityIdsByAreaId).map(([areaId, byKind]) => {
            const result = emptyByKind();
            for (const kind of ['temperature', 'humidity', 'light'] as const) {
              const ids = byKind[kind] ?? [];
              result[kind] = Object.fromEntries(Array.from(ids, (id) => [id, true]));
            }
            return [areaId, result];
          })
        );

      set({
        areaNameById,
        householdDeviceIdsByAreaId: normalizedDeviceIdsByAreaId,
        householdEntityIdsByAreaId: normalizedEntityIdsByAreaId,
      });
    },

    clear: () => {
      set({ areaNameById: {}, householdDeviceIdsByAreaId: {}, householdEntityIdsByAreaId: {} });
    },
  }))
);
