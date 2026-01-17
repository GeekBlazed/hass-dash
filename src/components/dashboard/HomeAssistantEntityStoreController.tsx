import { useEffect } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IEntityLabelService } from '../../interfaces/IEntityLabelService';
import type { IEntityService } from '../../interfaces/IEntityService';
import type { IHouseholdAreaEntityIndexService } from '../../interfaces/IHouseholdAreaEntityIndexService';
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
  const entityService = useService<IEntityService>(TYPES.IEntityService);
  const entityLabelService = useService<IEntityLabelService>(TYPES.IEntityLabelService);
  const householdAreaIndexService = useService<IHouseholdAreaEntityIndexService>(
    TYPES.IHouseholdAreaEntityIndexService
  );
  const setAllEntities = useEntityStore((s) => s.setAll);
  const upsertManyEntities = useEntityStore((s) => s.upsertMany);
  const setHouseholdEntityIds = useEntityStore((s) => s.setHouseholdEntityIds);
  const setHouseholdAreaIndex = useHouseholdAreaEntityIndexStore((s) => s.setIndex);

  useEffect(() => {
    const forceAllEntitiesInDev =
      import.meta.env.DEV &&
      (() => {
        try {
          return new URLSearchParams(window.location.search).has('allEntities');
        } catch {
          return false;
        }
      })();

    const explicitEntityIdSet = entityIds ? new Set(entityIds) : null;

    const mode: 'explicit' | 'all' | 'reduced' = explicitEntityIdSet
      ? 'explicit'
      : forceAllEntitiesInDev
        ? 'all'
        : 'reduced';
    const shouldReduceSubscriptions = mode === 'reduced';

    let shouldCapture: (state: HaEntityState) => boolean;
    let subscriptionEntityIds: string[] | null;

    if (explicitEntityIdSet) {
      shouldCapture = (state) => explicitEntityIdSet.has(state.entity_id);
      subscriptionEntityIds = entityIds ? [...entityIds] : [];
    } else if (mode === 'all') {
      shouldCapture = () => true;
      subscriptionEntityIds = null;
    } else {
      // We'll compute the reduced set after resolving labels and reading the initial snapshot.
      const computedSet = new Set<string>();
      shouldCapture = (state) => computedSet.has(state.entity_id);
      subscriptionEntityIds = [];
    }

    let subscription: { unsubscribe: () => Promise<void> } | null = null;
    const pendingByEntityId = new Map<string, HaEntityState>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPending = () => {
      flushTimer = null;
      if (pendingByEntityId.size === 0) return;
      const batch = Array.from(pendingByEntityId.values());
      pendingByEntityId.clear();
      upsertManyEntities(batch);
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      // Keep the WS message handler lightweight by batching updates.
      flushTimer = setTimeout(flushPending, 50);
    };

    void (async () => {
      // When reducing subscriptions, compute a stable allow-list from a single label.
      // This reduces WS traffic by not subscribing to noisy entities.
      const reducedEntityIdSet = shouldReduceSubscriptions ? new Set<string>() : null;

      try {
        const ids = await entityLabelService.getEntityIdsByLabelName('hass-dash');
        setHouseholdEntityIds(ids);

        if (reducedEntityIdSet) {
          for (const entityId of ids) reducedEntityIdSet.add(entityId);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to fetch hass-dash label entities: ${message}`);
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

        if (mode === 'all') {
          setAllEntities(states);
        } else if (mode === 'explicit') {
          const filtered = states.filter(shouldCapture);
          if (filtered.length > 0) {
            upsertManyEntities(filtered);
          }
        } else {
          // Update our local capture predicate + subscription allowlist.
          const reducedIds = Array.from(reducedEntityIdSet ?? []);
          subscriptionEntityIds = reducedIds;

          shouldCapture = (state) => reducedEntityIdSet?.has(state.entity_id) === true;

          const filtered = states.filter(shouldCapture);
          if (filtered.length > 0) {
            upsertManyEntities(filtered);
          }
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to fetch initial entity states: ${message}`);
      }

      try {
        const onNext = (next: HaEntityState) => {
          if (!shouldCapture(next)) return;
          // Dedupe within the batch window: keep only the latest update per entity.
          pendingByEntityId.set(next.entity_id, next);
          scheduleFlush();
        };

        if (subscriptionEntityIds && entityService.subscribeToStateChangesFiltered) {
          if (subscriptionEntityIds.length > 0) {
            subscription = await entityService.subscribeToStateChangesFiltered(
              subscriptionEntityIds,
              onNext
            );
          } else {
            logger.warn('Reduced subscription list is empty; skipping state subscription');
          }
        } else {
          subscription = await entityService.subscribeToStateChanges(onNext);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to subscribe to entity updates: ${message}`);
      }
    })();

    return () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      pendingByEntityId.clear();
      if (subscription) {
        void subscription.unsubscribe();
      }
    };
  }, [
    entityIds,
    entityService,
    entityLabelService,
    householdAreaIndexService,
    setAllEntities,
    setHouseholdAreaIndex,
    setHouseholdEntityIds,
    upsertManyEntities,
  ]);

  return null;
}
