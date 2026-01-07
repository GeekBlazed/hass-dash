import type { IEntityService } from '../interfaces/IEntityService';
import type { IHaSubscription } from '../interfaces/IHomeAssistantClient';
import type { HaEntityState } from '../types/home-assistant';

import {
  extractDeviceLocationUpdateFromHaEntityState,
  type DeviceLocationUpdate,
} from '../features/tracking/espresense/espresenseLocationExtractor';
import { getEspresenseMinConfidence } from '../features/tracking/espresense/espresenseTrackingConfig';
import type { DeviceLocation } from '../stores/useDeviceLocationStore';

export interface IDeviceLocationStoreSink {
  upsert(entityId: string, location: DeviceLocation): void;
}

export class DeviceLocationTrackingService {
  private subscription: IHaSubscription | null = null;

  private readonly entityService: IEntityService;
  private readonly minConfidence: number;
  private readonly store: IDeviceLocationStoreSink;

  constructor(
    entityService: IEntityService,
    store: IDeviceLocationStoreSink,
    minConfidence: number = getEspresenseMinConfidence()
  ) {
    this.entityService = entityService;
    this.minConfidence = minConfidence;
    this.store = store;
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
    const updates = extractDeviceLocationUpdateFromHaEntityState(next, this.minConfidence);
    for (const update of updates) {
      this.store.upsert(update.entityId, mapUpdateToDeviceLocation(update));
    }
  }
}

const mapUpdateToDeviceLocation = (update: DeviceLocationUpdate): DeviceLocation => {
  return {
    position: update.position,
    confidence: update.confidence,
    lastSeen: update.lastSeen,
    receivedAt: update.receivedAt,
  };
};
