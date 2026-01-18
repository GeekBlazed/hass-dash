import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IEntityLabelService } from '../interfaces/IEntityLabelService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaEntityId } from '../types/home-assistant';

type HaLabelRegistryEntry = {
  label_id?: unknown;
  name?: unknown;
};

type HaEntityRegistryEntry = {
  entity_id?: unknown;
  device_id?: unknown;
  labels?: unknown;
};

type HaDeviceRegistryEntry = {
  id?: unknown;
  labels?: unknown;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
};

const normalizeName = (name: string): string => name.trim().toLowerCase();

@injectable()
export class HomeAssistantEntityLabelService implements IEntityLabelService {
  private cached: Map<string, { at: number; ids: Set<HaEntityId> }> = new Map();
  private inFlight: Map<string, Promise<Set<HaEntityId>>> = new Map();

  // Labels/registry don't change frequently.
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(@inject(TYPES.IHomeAssistantClient) private haClient: IHomeAssistantClient) {}

  async getEntityIdsByLabelName(labelName: string): Promise<Set<HaEntityId>> {
    const normalized = normalizeName(labelName);
    if (!normalized) return new Set();

    const now = Date.now();
    const cached = this.cached.get(normalized);
    if (cached && now - cached.at < this.cacheTtlMs) {
      return new Set(cached.ids);
    }

    const inFlight = this.inFlight.get(normalized);
    if (inFlight) {
      return inFlight.then((s) => new Set(s));
    }

    const promise = this.fetchEntityIdsByLabelName(normalized);
    this.inFlight.set(normalized, promise);

    try {
      const ids = await promise;
      this.cached.set(normalized, { at: Date.now(), ids: new Set(ids) });
      return new Set(ids);
    } finally {
      this.inFlight.delete(normalized);
    }
  }

  private async fetchEntityIdsByLabelName(normalizedLabelName: string): Promise<Set<HaEntityId>> {
    if (!this.haClient.isConnected()) {
      await this.haClient.connect();
    }

    const labelRegistry = (await this.haClient.getLabelRegistry?.()) ?? [];
    const entityRegistry = (await this.haClient.getEntityRegistry?.()) ?? [];
    const deviceRegistry = (await this.haClient.getDeviceRegistry?.()) ?? [];

    const matchingLabelIds = new Set<string>();
    for (const entry of labelRegistry as HaLabelRegistryEntry[]) {
      const labelId = entry?.label_id;
      const name = entry?.name;
      if (!isNonEmptyString(labelId) || !isNonEmptyString(name)) continue;
      if (normalizeName(name) === normalizedLabelName) {
        matchingLabelIds.add(labelId);
      }
    }

    if (matchingLabelIds.size === 0) {
      return new Set<HaEntityId>();
    }

    const labeledDeviceIds = new Set<string>();
    for (const entry of deviceRegistry as HaDeviceRegistryEntry[]) {
      const deviceId = entry?.id;
      if (!isNonEmptyString(deviceId)) continue;

      const labels = asStringArray(entry?.labels);
      if (labels.some((l) => matchingLabelIds.has(l))) {
        labeledDeviceIds.add(deviceId);
      }
    }

    const ids = new Set<HaEntityId>();
    for (const entry of entityRegistry as HaEntityRegistryEntry[]) {
      const entityId = entry?.entity_id;
      if (!isNonEmptyString(entityId)) continue;

      const deviceId = entry?.device_id;
      if (isNonEmptyString(deviceId) && labeledDeviceIds.has(deviceId)) {
        ids.add(entityId as HaEntityId);
        continue;
      }

      const labels = asStringArray(entry?.labels);
      if (labels.some((l) => matchingLabelIds.has(l))) {
        ids.add(entityId as HaEntityId);
      }
    }

    return ids;
  }
}
