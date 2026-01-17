import type { IEntityService } from '../interfaces/IEntityService';
import type { IHaSubscription } from '../interfaces/IHomeAssistantClient';
import type { HaEntityState } from '../types/home-assistant';

import {
  extractDeviceLocationUpdateFromHaEntityState,
  type DeviceLocationUpdate,
} from '../features/tracking/espresense/espresenseLocationExtractor';
import { getEspresenseMinConfidence } from '../features/tracking/espresense/espresenseTrackingConfig';
import type { DeviceLocation } from '../stores/useDeviceLocationStore';

export interface IDeviceLocationStore {
  upsert(entityId: string, location: DeviceLocation): void;
  remove?(entityId: string): void;
}

// Backwards-compat alias (the service treats this dependency as write-only)
export type IDeviceLocationStoreSink = IDeviceLocationStore;

export interface DeviceLocationTrackingHardeningOptions {
  /**
   * Limits updates per entity to avoid UI thrash.
   *
   * Behavior: per entity id, allow at most `maxUpdatesPerWindow` updates in any
   * `windowMs` rolling window (implemented as a simple fixed window).
   */
  throttle?: {
    windowMs: number;
    maxUpdatesPerWindow: number;
  };

  /**
   * When enabled, if `last_seen` is present and parseable, ignore updates whose
   * `last_seen` is older than the most recently accepted `last_seen`.
   */
  enableLastSeenStaleGuard?: boolean;
}

const DEFAULT_HARDENING: DeviceLocationTrackingHardeningOptions = {
  throttle: {
    windowMs: 1000,
    maxUpdatesPerWindow: 4,
  },
  enableLastSeenStaleGuard: true,
};

type ThrottleState = {
  windowStartAt: number;
  count: number;
};

export class DeviceLocationTrackingService {
  private subscription: IHaSubscription | null = null;

  private readonly entityService: IEntityService;
  private readonly minConfidence: number;
  private readonly store: IDeviceLocationStore;

  private readonly hardening: DeviceLocationTrackingHardeningOptions;
  private readonly throttleByEntityId = new Map<string, ThrottleState>();
  private readonly lastSeenMsByEntityId = new Map<string, number>();

  constructor(
    entityService: IEntityService,
    store: IDeviceLocationStore,
    minConfidence: number = getEspresenseMinConfidence(),
    hardening: DeviceLocationTrackingHardeningOptions = DEFAULT_HARDENING
  ) {
    this.entityService = entityService;
    this.minConfidence = minConfidence;
    this.store = store;
    this.hardening = hardening;
  }

  async start(): Promise<void> {
    if (this.subscription) return;

    this.subscription = await this.entityService.subscribeToStateChanges((next) => {
      this.handleEntityState(next);
    });
  }

  async stop(): Promise<void> {
    const sub = this.subscription;
    this.subscription = null;
    if (sub) {
      await sub.unsubscribe();
    }
  }

  private handleEntityState(next: HaEntityState): void {
    // Device tracking is intentionally limited to `device_tracker.*` entities.
    // Returning early here avoids doing attribute parsing work for unrelated
    // high-frequency sensors (which can cause UI thrash and WS backpressure).
    if (!next.entity_id.startsWith('device_tracker.')) return;

    if (next.entity_id.startsWith('device_tracker.') && isAwayState(next.state)) {
      this.store.remove?.(next.entity_id);
      this.throttleByEntityId.delete(next.entity_id);
      this.lastSeenMsByEntityId.delete(next.entity_id);
      return;
    }

    const updates = extractDeviceLocationUpdateFromHaEntityState(next, this.minConfidence);
    for (const update of updates) {
      if (!this.shouldAcceptUpdate(update)) continue;
      this.store.upsert(update.entityId, mapUpdateToDeviceLocation(update));
    }
  }

  private shouldAcceptUpdate(update: DeviceLocationUpdate): boolean {
    if (!this.passesThrottle(update)) return false;
    if (!this.passesLastSeenGuard(update)) return false;
    return true;
  }

  private passesThrottle(update: DeviceLocationUpdate): boolean {
    const throttle = this.hardening.throttle;
    if (!throttle) return true;

    const { windowMs, maxUpdatesPerWindow } = throttle;
    if (!(windowMs > 0) || !(maxUpdatesPerWindow > 0)) return true;

    const now = update.receivedAt;
    const prev = this.throttleByEntityId.get(update.entityId);
    if (!prev) {
      this.throttleByEntityId.set(update.entityId, { windowStartAt: now, count: 1 });
      return true;
    }

    if (now - prev.windowStartAt >= windowMs) {
      this.throttleByEntityId.set(update.entityId, { windowStartAt: now, count: 1 });
      return true;
    }

    if (prev.count >= maxUpdatesPerWindow) {
      return false;
    }

    prev.count += 1;
    return true;
  }

  private passesLastSeenGuard(update: DeviceLocationUpdate): boolean {
    if (!this.hardening.enableLastSeenStaleGuard) return true;

    const lastSeenRaw = update.lastSeen;
    if (!lastSeenRaw) return true;

    const nextMs = Date.parse(lastSeenRaw);
    if (!Number.isFinite(nextMs)) return true;

    const prevMs = this.lastSeenMsByEntityId.get(update.entityId);
    if (prevMs !== undefined && nextMs < prevMs) {
      return false;
    }

    this.lastSeenMsByEntityId.set(update.entityId, nextMs);
    return true;
  }
}

const mapUpdateToDeviceLocation = (update: DeviceLocationUpdate): DeviceLocation => {
  return {
    position: update.position,
    geo: update.geo,
    confidence: update.confidence,
    lastSeen: update.lastSeen,
    receivedAt: update.receivedAt,
  };
};

const isAwayState = (state: unknown): boolean => {
  // Common HA device_tracker states: "home" | "not_home".
  // Some integrations may use "away" or other strings.
  if (typeof state !== 'string') return false;
  const normalized = state.trim().toLowerCase();
  return normalized === 'not_home' || normalized === 'away';
};
