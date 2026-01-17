import { useEffect, useRef } from 'react';

import { TYPES } from '../../core/types';
import { extractDeviceLocationUpdateFromHaEntityState } from '../../features/tracking/espresense/espresenseLocationExtractor';
import { getEspresenseMinConfidence } from '../../features/tracking/espresense/espresenseTrackingConfig';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useService } from '../../hooks/useService';
import type { IDeviceTrackerMetadataService } from '../../interfaces/IDeviceTrackerMetadataService';
import type { IEntityService } from '../../interfaces/IEntityService';
import type { IHomeAssistantConnectionConfig } from '../../interfaces/IHomeAssistantConnectionConfig';
import { DeviceLocationTrackingService } from '../../services/DeviceLocationTrackingService';
import { useDeviceLocationStore } from '../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../stores/useDeviceTrackerMetadataStore';
import {
  computeInitials,
  deriveBaseUrlFromWebSocketUrl,
  resolveEntityPictureUrl,
} from '../../utils/deviceLocationTracking';
import { createLogger } from '../../utils/logger';

type HassDashDebugWindow = Window & {
  __hassDashDebug?: {
    deviceTrackerMetadata?: Record<string, unknown>;
    getDeviceTrackerMetadataStoreState?: () => unknown;
  };
};

const logger = createLogger('hass-dash');

export function DeviceLocationTrackingController({
  entityService: entityServiceOverride,
}: {
  entityService?: IEntityService;
}) {
  const { isEnabled: trackingEnabled } = useFeatureFlag('DEVICE_TRACKING');
  const { isEnabled: haEnabled } = useFeatureFlag('HA_CONNECTION');

  const metadataByEntityId = useDeviceTrackerMetadataStore((s) => s.metadataByEntityId);

  // Only show trackers that are assigned to a Home Assistant person.
  // We track this in-memory so we can filter incoming updates and prune stale locations.
  const personTrackersByPersonEntityIdRef = useRef<Map<string, Set<string>>>(new Map());
  const allowedTrackerEntityIdsRef = useRef<Set<string>>(new Set());

  const diEntityService = useService<IEntityService>(TYPES.IEntityService);
  const entityService = entityServiceOverride ?? diEntityService;

  const deviceTrackerMetadataService = useService<IDeviceTrackerMetadataService>(
    TYPES.IDeviceTrackerMetadataService
  );

  const connectionConfig = useService<IHomeAssistantConnectionConfig>(
    TYPES.IHomeAssistantConnectionConfig
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (trackingEnabled && !haEnabled) {
      logger.warn(
        'DEVICE_TRACKING is enabled but HA_CONNECTION is disabled. Device tracking will not start.'
      );
    }
  }, [trackingEnabled, haEnabled]);

  useEffect(() => {
    if (!trackingEnabled || !haEnabled) return;

    void deviceTrackerMetadataService
      .fetchByEntityId()
      .then((metadataByEntityId) => {
        useDeviceTrackerMetadataStore.getState().setAll(metadataByEntityId);

        if (import.meta.env.DEV) {
          const debugWindow = window as HassDashDebugWindow;
          debugWindow.__hassDashDebug = debugWindow.__hassDashDebug ?? {};
          debugWindow.__hassDashDebug.deviceTrackerMetadata = metadataByEntityId;
          debugWindow.__hassDashDebug.getDeviceTrackerMetadataStoreState = () =>
            useDeviceTrackerMetadataStore.getState();

          const rows = Object.entries(metadataByEntityId)
            .slice(0, 25)
            .map(([entityId, meta]) => ({ entityId, ...(meta ?? {}) }));

          logger.debugGroupCollapsed(
            `device tracker metadata loaded (${Object.keys(metadataByEntityId).length})`
          );
          logger.debugTable(rows);
          logger.debug('Full map available at: window.__hassDashDebug.deviceTrackerMetadata');
          logger.debug(
            'Store state available at: window.__hassDashDebug.getDeviceTrackerMetadataStoreState()'
          );
          logger.debugGroupEnd();
        }
      })
      .catch((error: unknown) => {
        if (!import.meta.env.DEV) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to load device tracker metadata: ${message}`);
      });

    const service = new DeviceLocationTrackingService(entityService, {
      upsert: (entityId, location) => {
        if (!allowedTrackerEntityIdsRef.current.has(entityId)) return;
        useDeviceLocationStore.getState().upsert(entityId, location);
      },
      remove: (entityId) => {
        if (!allowedTrackerEntityIdsRef.current.has(entityId)) return;
        useDeviceLocationStore.getState().remove(entityId);
      },
    });

    void service.start().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Device location tracking failed to start: ${message}`);
    });

    return () => {
      void service.stop();
    };
  }, [trackingEnabled, haEnabled, entityService, deviceTrackerMetadataService]);

  useEffect(() => {
    if (!trackingEnabled || !haEnabled) return;

    let subscription: { unsubscribe: () => Promise<void> } | null = null;

    const recomputeAllowlistAndPrune = (): void => {
      const nextAllowed = new Set<string>();
      const allowedDeviceIds = new Set<string>();

      for (const ids of personTrackersByPersonEntityIdRef.current.values()) {
        for (const id of ids) {
          nextAllowed.add(id);

          const meta = metadataByEntityId[id];
          const deviceId = typeof meta?.deviceId === 'string' ? meta.deviceId : undefined;
          if (deviceId) allowedDeviceIds.add(deviceId);
        }
      }

      // Some Home Assistant setups can end up with multiple `device_tracker.*` entities for the
      // same underlying device (e.g. rename / duplicate MQTT discovery object_id). We want
      // people-assigned trackers to continue working even if the entity id that receives the
      // ESPresense attributes differs from the one stored under `person.*.device_trackers`.
      if (allowedDeviceIds.size > 0) {
        for (const [entityId, meta] of Object.entries(metadataByEntityId)) {
          const deviceId = typeof meta?.deviceId === 'string' ? meta.deviceId : undefined;
          if (!deviceId) continue;
          if (!allowedDeviceIds.has(deviceId)) continue;
          nextAllowed.add(entityId);
        }
      }

      allowedTrackerEntityIdsRef.current = nextAllowed;
      useDeviceLocationStore.getState().pruneToEntityIds(nextAllowed);
    };

    const extractDeviceTrackersFromPersonState = (next: {
      entity_id: string;
      attributes?: Record<string, unknown>;
    }): Set<string> => {
      if (!next.entity_id.startsWith('person.')) return new Set();

      const attrs = (next.attributes ?? {}) as Record<string, unknown>;
      const deviceTrackers = attrs.device_trackers;
      if (!Array.isArray(deviceTrackers)) return new Set();

      const result = new Set<string>();
      for (const trackerEntityId of deviceTrackers) {
        if (typeof trackerEntityId !== 'string') continue;
        if (!trackerEntityId.startsWith('device_tracker.')) continue;
        result.add(trackerEntityId);
      }

      return result;
    };

    const handleStateChange = (next: {
      entity_id: string;
      attributes?: Record<string, unknown>;
    }): void => {
      if (!next.entity_id.startsWith('person.')) return;

      const assignedTrackers = extractDeviceTrackersFromPersonState(next);
      personTrackersByPersonEntityIdRef.current.set(next.entity_id, assignedTrackers);
      recomputeAllowlistAndPrune();

      // Keep labels in sync with person name changes.
      const attrs = (next.attributes ?? {}) as Record<string, unknown>;
      const personName = typeof attrs.friendly_name === 'string' ? attrs.friendly_name.trim() : '';
      if (!personName) return;

      const entityPicture =
        typeof attrs.entity_picture === 'string' ? attrs.entity_picture : undefined;

      const cfg = connectionConfig.getConfig();
      const baseUrl = cfg.baseUrl?.trim()
        ? cfg.baseUrl.trim()
        : (() => {
            const wsUrl = cfg.webSocketUrl?.trim() || connectionConfig.getEffectiveWebSocketUrl();
            if (!wsUrl) return undefined;
            return deriveBaseUrlFromWebSocketUrl(wsUrl);
          })();

      const avatarUrl = entityPicture ? resolveEntityPictureUrl(entityPicture, baseUrl) : undefined;
      const initials = computeInitials(personName);

      const store = useDeviceTrackerMetadataStore.getState();
      for (const trackerEntityId of assignedTrackers) {
        store.upsert(trackerEntityId, { name: personName, avatarUrl, initials });
      }
    };

    const start = async (): Promise<void> => {
      try {
        // Seed allowlist from a snapshot so we don't show stale/persisted trackers
        // and we don't wait for a future `state_changed` to populate assignments.
        const states = await entityService.fetchStates();
        personTrackersByPersonEntityIdRef.current.clear();
        for (const state of states) {
          if (!state.entity_id.startsWith('person.')) continue;
          const assigned = extractDeviceTrackersFromPersonState(state);
          personTrackersByPersonEntityIdRef.current.set(state.entity_id, assigned);
        }
        recomputeAllowlistAndPrune();

        // Seed initial locations from the snapshot so trackers render even if
        // they don't emit a post-subscribe `state_changed` immediately.
        // This keeps the UI aligned with HA "last known" state.
        const minConfidence = getEspresenseMinConfidence();
        const store = useDeviceLocationStore.getState();
        for (const state of states) {
          const entityId = state.entity_id;
          if (!allowedTrackerEntityIdsRef.current.has(entityId)) continue;

          // If HA considers the tracker Away, do not seed a marker.
          // (Live updates will remove it immediately as well.)
          if (typeof state.state === 'string') {
            const normalized = state.state.trim().toLowerCase();
            if (normalized === 'not_home' || normalized === 'away') {
              store.remove(entityId);
              continue;
            }
          }

          const receivedAtCandidate = Date.parse(state.last_updated);
          const receivedAt = Number.isFinite(receivedAtCandidate)
            ? receivedAtCandidate
            : Date.now();

          const updates = extractDeviceLocationUpdateFromHaEntityState(
            state,
            minConfidence,
            receivedAt
          );

          for (const update of updates) {
            store.upsert(update.entityId, {
              position: update.position,
              geo: update.geo,
              confidence: update.confidence,
              lastSeen: update.lastSeen,
              receivedAt: update.receivedAt,
            });
          }
        }

        subscription = await entityService.subscribeToStateChanges(handleStateChange);
      } catch (error: unknown) {
        if (!import.meta.env.DEV) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to subscribe to person state changes: ${message}`);
      }
    };

    void start();

    return () => {
      const sub = subscription;
      subscription = null;
      void sub?.unsubscribe();
    };
  }, [trackingEnabled, haEnabled, entityService, connectionConfig, metadataByEntityId]);

  return null;
}
