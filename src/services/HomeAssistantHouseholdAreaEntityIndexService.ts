import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type {
  HouseholdAreaInfo,
  HouseholdEntityKind,
  IHouseholdAreaEntityIndexService,
} from '../interfaces/IHouseholdAreaEntityIndexService';

type HaLabelRegistryEntry = {
  label_id?: unknown;
  name?: unknown;
};

type HaAreaRegistryEntry = {
  area_id?: unknown;
  name?: unknown;
};

type HaDeviceRegistryEntry = {
  id?: unknown;
  device_id?: unknown;
  area_id?: unknown;
  labels?: unknown;
};

type HaEntityRegistryEntry = {
  entity_id?: unknown;
  device_id?: unknown;
  area_id?: unknown;
  labels?: unknown;
};

type IndexSnapshot = {
  areas: HouseholdAreaInfo[];
  householdDeviceIdsByAreaId: Map<string, Set<string>>;
  householdEntityIdsByAreaId: Map<string, Map<HouseholdEntityKind, Set<string>>>;
};

const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const asStringOrNull = (value: unknown): string | null => {
  if (value === null) return null;
  return isNonEmptyString(value) ? value : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
};

const getDomain = (entityId: string): string => {
  const dot = entityId.indexOf('.');
  return dot >= 0 ? entityId.slice(0, dot) : '';
};

const matchesKind = (entityId: string, kind: HouseholdEntityKind): boolean => {
  const id = entityId.toLowerCase();
  const domain = getDomain(id);

  if (kind === 'light') {
    return domain === 'light';
  }

  // Temperature/humidity are typically `sensor.*`, but some setups may include `climate.*`
  // or custom entities. We keep it keyword-driven with a light domain guard.
  const supportsDomain = domain === 'sensor' || domain === 'climate';
  if (!supportsDomain) return false;

  if (kind === 'temperature') {
    return id.includes('temperature') || id.includes('temp');
  }

  return id.includes('humidity') || id.includes('humid');
};

const emptyKindMap = (): Map<HouseholdEntityKind, Set<string>> => {
  return new Map<HouseholdEntityKind, Set<string>>([
    ['temperature', new Set<string>()],
    ['humidity', new Set<string>()],
    ['light', new Set<string>()],
  ]);
};

@injectable()
export class HomeAssistantHouseholdAreaEntityIndexService implements IHouseholdAreaEntityIndexService {
  private cached: { at: number; snapshot: IndexSnapshot } | null = null;
  private inFlight: Promise<IndexSnapshot> | null = null;

  // Registries are fairly stable, but we still refresh periodically.
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(@inject(TYPES.IHomeAssistantClient) private haClient: IHomeAssistantClient) {}

  async getAllAreas(): Promise<HouseholdAreaInfo[]> {
    const snapshot = await this.getSnapshot();
    return [...snapshot.areas];
  }

  async getHouseholdDeviceIdsByAreaId(areaId: string): Promise<Set<string>> {
    const snapshot = await this.getSnapshot();
    return new Set(snapshot.householdDeviceIdsByAreaId.get(areaId) ?? []);
  }

  async getHouseholdEntityIdsByAreaId(
    areaId: string,
    kind: HouseholdEntityKind
  ): Promise<Set<string>> {
    const snapshot = await this.getSnapshot();
    const byKind = snapshot.householdEntityIdsByAreaId.get(areaId);
    const ids = byKind?.get(kind) ?? new Set<string>();
    return new Set(ids);
  }

  async refresh(): Promise<void> {
    const snapshot = await this.fetchSnapshot();
    this.cached = { at: Date.now(), snapshot };
  }

  private async getSnapshot(): Promise<IndexSnapshot> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < this.cacheTtlMs) {
      return this.cached.snapshot;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.fetchSnapshot();
    try {
      const snapshot = await this.inFlight;
      this.cached = { at: Date.now(), snapshot };
      return snapshot;
    } finally {
      this.inFlight = null;
    }
  }

  private async fetchSnapshot(): Promise<IndexSnapshot> {
    if (!this.haClient.isConnected()) {
      await this.haClient.connect();
    }

    const [labelRegistryRaw, areaRegistryRaw, deviceRegistryRaw, entityRegistryRaw] =
      await Promise.all([
        this.haClient.getLabelRegistry?.() ?? [],
        this.haClient.getAreaRegistry?.() ?? [],
        this.haClient.getDeviceRegistry?.() ?? [],
        this.haClient.getEntityRegistry?.() ?? [],
      ]);

    const labelRegistry = Array.isArray(labelRegistryRaw) ? labelRegistryRaw : [];
    const areaRegistry = Array.isArray(areaRegistryRaw) ? areaRegistryRaw : [];
    const deviceRegistry = Array.isArray(deviceRegistryRaw) ? deviceRegistryRaw : [];
    const entityRegistry = Array.isArray(entityRegistryRaw) ? entityRegistryRaw : [];

    const householdLabelIds = new Set<string>();
    for (const entry of labelRegistry as HaLabelRegistryEntry[]) {
      const labelId = entry?.label_id;
      const name = entry?.name;
      if (!isNonEmptyString(labelId) || !isNonEmptyString(name)) continue;
      if (name.trim().toLowerCase() === 'household') {
        householdLabelIds.add(labelId);
      }
    }

    const areas: HouseholdAreaInfo[] = [];
    for (const entry of areaRegistry as HaAreaRegistryEntry[]) {
      const areaId = entry?.area_id;
      if (!isNonEmptyString(areaId)) continue;
      const name = isNonEmptyString(entry?.name) ? entry.name : undefined;
      areas.push({ areaId, name });
    }

    // If Household doesn't exist, return areas but no household-derived sets.
    if (householdLabelIds.size === 0) {
      return {
        areas,
        householdDeviceIdsByAreaId: new Map<string, Set<string>>(),
        householdEntityIdsByAreaId: new Map<string, Map<HouseholdEntityKind, Set<string>>>(),
      };
    }

    const householdDeviceIds = new Set<string>();
    const deviceAreaIdByDeviceId = new Map<string, string>();

    for (const entry of deviceRegistry as HaDeviceRegistryEntry[]) {
      const id = asStringOrNull(entry?.id) ?? asStringOrNull(entry?.device_id);
      if (!id) continue;

      const areaId = asStringOrNull(entry?.area_id);
      if (areaId) {
        deviceAreaIdByDeviceId.set(id, areaId);
      }

      const labels = asStringArray(entry?.labels);
      if (labels.some((l) => householdLabelIds.has(l))) {
        householdDeviceIds.add(id);
      }
    }

    const householdDeviceIdsByAreaId = new Map<string, Set<string>>();
    for (const deviceId of householdDeviceIds) {
      const areaId = deviceAreaIdByDeviceId.get(deviceId);
      if (!areaId) continue;

      const set = householdDeviceIdsByAreaId.get(areaId) ?? new Set<string>();
      set.add(deviceId);
      householdDeviceIdsByAreaId.set(areaId, set);
    }

    const householdEntityIdsByAreaId = new Map<string, Map<HouseholdEntityKind, Set<string>>>();

    for (const entry of entityRegistry as HaEntityRegistryEntry[]) {
      const entityId = asStringOrNull(entry?.entity_id);
      if (!entityId) continue;

      const deviceId = asStringOrNull(entry?.device_id);
      const labels = asStringArray(entry?.labels);

      const isHousehold =
        labels.some((l) => householdLabelIds.has(l)) ||
        (deviceId ? householdDeviceIds.has(deviceId) : false);

      if (!isHousehold) continue;

      const directAreaId = asStringOrNull(entry?.area_id);
      const inheritedAreaId = deviceId ? deviceAreaIdByDeviceId.get(deviceId) : undefined;
      const effectiveAreaId = directAreaId ?? inheritedAreaId;
      if (!effectiveAreaId) continue;

      const byKind = householdEntityIdsByAreaId.get(effectiveAreaId) ?? emptyKindMap();

      for (const kind of ['temperature', 'humidity', 'light'] as const) {
        if (!matchesKind(entityId, kind)) continue;
        const set = byKind.get(kind);
        if (set) {
          set.add(entityId);
        }
      }

      householdEntityIdsByAreaId.set(effectiveAreaId, byKind);
    }

    return {
      areas,
      householdDeviceIdsByAreaId,
      householdEntityIdsByAreaId,
    };
  }
}
