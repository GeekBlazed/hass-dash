import { useEffect } from 'react';

import { TYPES } from '../../core/types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useService } from '../../hooks/useService';
import type { IEntityService } from '../../interfaces/IEntityService';
import type { IHouseholdAreaEntityIndexService } from '../../interfaces/IHouseholdAreaEntityIndexService';
import type { IHouseholdEntityLabelService } from '../../interfaces/IHouseholdEntityLabelService';
import { useEntityStore } from '../../stores/useEntityStore';
import { useHouseholdAreaEntityIndexStore } from '../../stores/useHouseholdAreaEntityIndexStore';
import type { HaEntityState } from '../../types/home-assistant';
import { createLogger } from '../../utils/logger';

const logger = createLogger('hass-dash');

export function HomeAssistantEntityStoreController({
  entityIds,
}: {
  entityIds?: ReadonlyArray<string>;
}) {
  const { isEnabled: haEnabled } = useFeatureFlag('HA_CONNECTION');

  const entityService = useService<IEntityService>(TYPES.IEntityService);
  const householdLabelService = useService<IHouseholdEntityLabelService>(
    TYPES.IHouseholdEntityLabelService
  );
  const householdAreaIndexService = useService<IHouseholdAreaEntityIndexService>(
    TYPES.IHouseholdAreaEntityIndexService
  );
  const setAllEntities = useEntityStore((s) => s.setAll);
  const upsertEntity = useEntityStore((s) => s.upsert);
  const setHouseholdEntityIds = useEntityStore((s) => s.setHouseholdEntityIds);
  const setHouseholdAreaIndex = useHouseholdAreaEntityIndexStore((s) => s.setIndex);

  useEffect(() => {
    if (!haEnabled) return;

    const entityIdSet = entityIds ? new Set(entityIds) : null;
    const shouldCapture = (state: HaEntityState): boolean => {
      if (!entityIdSet) return true;
      return entityIdSet.has(state.entity_id);
    };

    let subscription: { unsubscribe: () => Promise<void> } | null = null;

    void (async () => {
      try {
        const ids = await householdLabelService.getHouseholdEntityIds();
        setHouseholdEntityIds(ids);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to fetch Household labels: ${message}`);
      }

      try {
        await householdAreaIndexService.refresh();
        const areas = await householdAreaIndexService.getAllAreas();

        const areaNameById = Object.fromEntries(
          areas.map((a) => [a.areaId, a.name] as const)
        ) as Record<string, string | undefined>;

        const householdDeviceIdsByAreaId: Record<string, Iterable<string>> = {};
        const householdEntityIdsByAreaId: Record<
          string,
          {
            temperature: Iterable<string>;
            humidity: Iterable<string>;
            light: Iterable<string>;
          }
        > = {};

        for (const area of areas) {
          householdDeviceIdsByAreaId[area.areaId] =
            await householdAreaIndexService.getHouseholdDeviceIdsByAreaId(area.areaId);

          householdEntityIdsByAreaId[area.areaId] = {
            temperature: await householdAreaIndexService.getHouseholdEntityIdsByAreaId(
              area.areaId,
              'temperature'
            ),
            humidity: await householdAreaIndexService.getHouseholdEntityIdsByAreaId(
              area.areaId,
              'humidity'
            ),
            light: await householdAreaIndexService.getHouseholdEntityIdsByAreaId(
              area.areaId,
              'light'
            ),
          };
        }

        setHouseholdAreaIndex({
          areaNameById,
          householdDeviceIdsByAreaId,
          householdEntityIdsByAreaId,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to build Household area/entity index: ${message}`);
      }

      try {
        const states = await entityService.fetchStates();
        if (!entityIdSet) {
          setAllEntities(states);
        } else {
          for (const state of states) {
            if (!shouldCapture(state)) continue;
            upsertEntity(state);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to fetch initial entity states: ${message}`);
      }

      try {
        subscription = await entityService.subscribeToStateChanges((next) => {
          if (!shouldCapture(next)) return;
          upsertEntity(next);
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to subscribe to entity updates: ${message}`);
      }
    })();

    return () => {
      if (subscription) {
        void subscription.unsubscribe();
      }
    };
  }, [
    haEnabled,
    entityIds,
    entityService,
    householdAreaIndexService,
    householdLabelService,
    setAllEntities,
    setHouseholdAreaIndex,
    setHouseholdEntityIds,
    upsertEntity,
  ]);

  return null;
}
