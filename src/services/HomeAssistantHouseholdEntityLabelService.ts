import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHouseholdEntityLabelService } from '../interfaces/IHouseholdEntityLabelService';
import type { HaEntityId } from '../types/home-assistant';

type HaLabelRegistryEntry = {
  label_id?: unknown;
  name?: unknown;
};

type HaEntityRegistryEntry = {
  entity_id?: unknown;
  labels?: unknown;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
};

/**
 * Resolves the set of entities labeled "Household" via Home Assistant registries.
 */
@injectable()
export class HomeAssistantHouseholdEntityLabelService implements IHouseholdEntityLabelService {
  private cached: { at: number; ids: Set<HaEntityId> } | null = null;
  private inFlight: Promise<Set<HaEntityId>> | null = null;

  // Conservative cache: labels/registry don't change frequently.
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(@inject(TYPES.IHomeAssistantClient) private haClient: IHomeAssistantClient) {}

  async getHouseholdEntityIds(): Promise<Set<HaEntityId>> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < this.cacheTtlMs) {
      return new Set(this.cached.ids);
    }

    if (this.inFlight) {
      return this.inFlight.then((s) => new Set(s));
    }

    this.inFlight = this.fetchHouseholdEntityIds();
    try {
      const ids = await this.inFlight;
      this.cached = { at: Date.now(), ids: new Set(ids) };
      return new Set(ids);
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchHouseholdEntityIds(): Promise<Set<HaEntityId>> {
    if (!this.haClient.isConnected()) {
      await this.haClient.connect();
    }

    const labelRegistry = (await this.haClient.getLabelRegistry?.()) ?? [];
    const entityRegistry = (await this.haClient.getEntityRegistry?.()) ?? [];

    const householdLabelIds = new Set<string>();
    for (const entry of labelRegistry as HaLabelRegistryEntry[]) {
      const labelId = entry?.label_id;
      const name = entry?.name;

      if (!isNonEmptyString(labelId) || !isNonEmptyString(name)) continue;
      if (name.trim().toLowerCase() === 'household') {
        householdLabelIds.add(labelId);
      }
    }

    // If label registry isn't available or Household doesn't exist, return empty set.
    if (householdLabelIds.size === 0) {
      return new Set<HaEntityId>();
    }

    const ids = new Set<HaEntityId>();
    for (const entry of entityRegistry as HaEntityRegistryEntry[]) {
      const entityId = entry?.entity_id;
      if (!isNonEmptyString(entityId)) continue;

      const labels = asStringArray(entry?.labels);
      if (labels.some((l) => householdLabelIds.has(l))) {
        ids.add(entityId as HaEntityId);
      }
    }

    return ids;
  }
}
