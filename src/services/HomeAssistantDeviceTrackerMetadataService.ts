import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type {
  DeviceTrackerMetadata,
  IDeviceTrackerMetadataService,
} from '../interfaces/IDeviceTrackerMetadataService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IHttpClient } from '../interfaces/IHttpClient';

type HaEntityRegistryEntry = {
  entity_id: string;
  device_id?: string | null;
  name?: string | null;
  original_name?: string | null;
};

type HaDeviceRegistryEntry = {
  id?: string;
  device_id?: string;
  name?: string | null;
  name_by_user?: string | null;
};

type FriendlyNameByEntityId = Record<string, string | undefined>;
type PersonMetadataByDeviceTrackerEntityId = Record<
  string,
  { name?: string; avatarUrl?: string } | undefined
>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const asStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  return undefined;
};

const asNullableStringOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return undefined;
  return undefined;
};

const deriveBaseUrlFromWebSocketUrl = (webSocketUrl: string): string | undefined => {
  try {
    const url = new URL(webSocketUrl.trim());

    // Map ws/wss -> http/https.
    if (url.protocol === 'ws:') url.protocol = 'http:';
    else if (url.protocol === 'wss:') url.protocol = 'https:';
    else return undefined;

    url.pathname = '/';
    url.search = '';
    url.hash = '';

    return url.toString();
  } catch {
    return undefined;
  }
};

const resolveEntityPictureUrl = (
  entityPicture: string,
  baseUrl: string | undefined
): string | undefined => {
  const raw = entityPicture.trim();
  if (!raw) return undefined;

  // Already absolute (or data URL).
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  // Relative to HA base URL.
  if (raw.startsWith('/')) {
    if (!baseUrl) return raw;
    return new URL(raw, baseUrl).toString();
  }

  // Unknown form; return as-is.
  return raw;
};

const computeInitials = (name: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const parts = trimmed
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';

  const firstChar = first[0] ?? '';
  const lastChar = last ? (last[0] ?? '') : '';
  const initials = `${firstChar}${lastChar}`.trim().toUpperCase();

  return initials || undefined;
};

const parseEntityRegistryEntry = (value: unknown): HaEntityRegistryEntry | null => {
  if (!isObjectRecord(value)) return null;
  const entityId = asStringOrUndefined(value.entity_id);
  if (!entityId) return null;

  const deviceIdRaw = value.device_id;
  const deviceId = deviceIdRaw === null ? null : asStringOrUndefined(deviceIdRaw);

  const name = asNullableStringOrUndefined(value.name);
  const originalName = asNullableStringOrUndefined(value.original_name);

  return {
    entity_id: entityId,
    device_id: deviceId ?? null,
    name,
    original_name: originalName,
  };
};

const parseDeviceRegistryEntry = (value: unknown): HaDeviceRegistryEntry | null => {
  if (!isObjectRecord(value)) return null;

  const id = asStringOrUndefined(value.id) ?? asStringOrUndefined(value.device_id);
  if (!id) return null;

  const name = asNullableStringOrUndefined(value.name);
  const nameByUser = asNullableStringOrUndefined(value.name_by_user);

  return {
    id,
    device_id: id,
    name,
    name_by_user: nameByUser,
  };
};

const getFriendlyNameByEntityId = async (
  haClient: IHomeAssistantClient,
  entityIds: string[]
): Promise<FriendlyNameByEntityId> => {
  if (entityIds.length === 0) return {};

  try {
    if (!haClient.isConnected()) {
      await haClient.connect();
    }

    const states = await haClient.getStates();
    const wanted = new Set(entityIds);

    const map: FriendlyNameByEntityId = {};
    for (const state of states) {
      const entityId = state.entity_id;
      if (!wanted.has(entityId)) continue;
      const attrs = state.attributes as Record<string, unknown>;
      const friendlyName =
        typeof attrs.friendly_name === 'string' ? attrs.friendly_name : undefined;
      map[entityId] = friendlyName;
    }

    return map;
  } catch {
    // If Home Assistant blocks get_states or the connection isn't ready,
    // we can still produce usable metadata from registries.
    return {};
  }
};

const getPersonNameByDeviceTrackerEntityId = async (
  haClient: IHomeAssistantClient,
  baseUrl: string | undefined
): Promise<PersonMetadataByDeviceTrackerEntityId> => {
  try {
    if (!haClient.isConnected()) {
      await haClient.connect();
    }

    const states = await haClient.getStates();

    const map: PersonMetadataByDeviceTrackerEntityId = {};
    for (const state of states) {
      const entityId = state.entity_id;
      if (!entityId.startsWith('person.')) continue;

      const attrs = state.attributes as Record<string, unknown>;
      const personName = typeof attrs.friendly_name === 'string' ? attrs.friendly_name : undefined;
      if (!personName) continue;

      const entityPictureRaw =
        typeof attrs.entity_picture === 'string' ? attrs.entity_picture : undefined;
      const avatarUrl = entityPictureRaw
        ? resolveEntityPictureUrl(entityPictureRaw, baseUrl)
        : undefined;

      const deviceTrackers = attrs.device_trackers;
      if (!Array.isArray(deviceTrackers)) continue;

      for (const trackerEntityId of deviceTrackers) {
        if (typeof trackerEntityId !== 'string') continue;
        if (!trackerEntityId.startsWith('device_tracker.')) continue;
        map[trackerEntityId] = { name: personName, avatarUrl };
      }
    }

    return map;
  } catch {
    return {};
  }
};

@injectable()
export class HomeAssistantDeviceTrackerMetadataService implements IDeviceTrackerMetadataService {
  private readonly haClient: IHomeAssistantClient;
  private readonly httpClient: IHttpClient;
  private readonly connectionConfig: IHomeAssistantConnectionConfig;

  constructor(
    @inject(TYPES.IHomeAssistantClient) haClient: IHomeAssistantClient,
    @inject(TYPES.IHttpClient) httpClient: IHttpClient,
    @inject(TYPES.IHomeAssistantConnectionConfig) connectionConfig: IHomeAssistantConnectionConfig
  ) {
    this.haClient = haClient;
    this.httpClient = httpClient;
    this.connectionConfig = connectionConfig;
  }

  private getBaseUrl(): string | undefined {
    const cfg = this.connectionConfig.getConfig();
    const baseUrl = cfg.baseUrl?.trim();
    if (baseUrl) return baseUrl;

    const wsUrl = cfg.webSocketUrl?.trim() || this.connectionConfig.getEffectiveWebSocketUrl();
    if (!wsUrl) return undefined;

    return deriveBaseUrlFromWebSocketUrl(wsUrl);
  }

  async fetchByEntityId(): Promise<Record<string, DeviceTrackerMetadata>> {
    const supportsWsRegistry =
      typeof this.haClient.getEntityRegistry === 'function' &&
      typeof this.haClient.getDeviceRegistry === 'function';

    const supportsRestRegistry =
      typeof this.httpClient.get === 'function' && typeof this.httpClient.post === 'function';

    const [entityRegistryRaw, deviceRegistryRaw] = supportsWsRegistry
      ? await (async () => {
          if (!this.haClient.isConnected()) {
            await this.haClient.connect();
          }

          const [entities, devices] = await Promise.all([
            this.haClient.getEntityRegistry!(),
            this.haClient.getDeviceRegistry!(),
          ]);

          return [entities, devices] as const;
        })()
      : supportsRestRegistry
        ? await Promise.all([
            this.httpClient.get<unknown[]>('/api/config/entity_registry/list'),
            this.httpClient.get<unknown[]>('/api/config/device_registry/list'),
          ])
        : [[], []];

    const entityRegistry = Array.isArray(entityRegistryRaw) ? entityRegistryRaw : [];
    const deviceRegistry = Array.isArray(deviceRegistryRaw) ? deviceRegistryRaw : [];

    // Prefer WS registry when available; it avoids REST/CORS/service-worker constraints.
    const devicesById = new Map<string, DeviceTrackerMetadata>();
    for (const row of deviceRegistry) {
      const parsed = parseDeviceRegistryEntry(row);
      if (!parsed) continue;
      const deviceId = parsed.id ?? parsed.device_id;
      if (!deviceId) continue;

      const displayName = parsed.name_by_user ?? parsed.name ?? undefined;
      const secondaryName = parsed.name_by_user ? (parsed.name ?? undefined) : undefined;

      const metadata: DeviceTrackerMetadata = {
        deviceId,
        // `name` is what we want to display on the floorplan.
        name: displayName,
        // `alias` is an optional secondary label (useful for debugging).
        alias: secondaryName,
      };
      devicesById.set(deviceId, metadata);
    }

    const deviceTrackerEntityIds = entityRegistry
      .map(parseEntityRegistryEntry)
      .filter((v): v is HaEntityRegistryEntry => Boolean(v))
      .map((v) => v.entity_id)
      .filter((id) => id.startsWith('device_tracker.'));

    const friendlyNamesByEntityId = await getFriendlyNameByEntityId(
      this.haClient,
      deviceTrackerEntityIds
    );

    // Optional UX improvement: if Home Assistant has `person.*` entities with
    // `device_trackers` assigned, prefer the person's friendly name as the label
    // for the tracker entity.
    const baseUrl = this.getBaseUrl();
    const personMetadataByDeviceTrackerEntityId = await getPersonNameByDeviceTrackerEntityId(
      this.haClient,
      baseUrl
    );

    const result: Record<string, DeviceTrackerMetadata> = {};
    for (const row of entityRegistry) {
      const parsed = parseEntityRegistryEntry(row);
      if (!parsed) continue;
      if (!parsed.entity_id.startsWith('device_tracker.')) continue;

      const deviceId = parsed.device_id ?? undefined;
      const deviceMetadata = deviceId ? devicesById.get(deviceId) : undefined;

      const friendlyName = friendlyNamesByEntityId[parsed.entity_id];
      const personMeta = personMetadataByDeviceTrackerEntityId[parsed.entity_id];
      const personName = personMeta?.name;
      const avatarUrl = personMeta?.avatarUrl;

      // Preferred: device registry user-friendly naming when the entity is linked to a device.
      // Fallback: entity registry name, then runtime state `friendly_name`, then original_name.
      const name =
        deviceMetadata?.name ??
        parsed.name ??
        (typeof friendlyName === 'string' ? friendlyName : undefined) ??
        parsed.original_name ??
        undefined;

      const finalName = typeof personName === 'string' ? personName : name;

      const initials = finalName ? computeInitials(finalName) : undefined;

      // Optional secondary label: fall back to original_name when the user supplied a name.
      const alias =
        deviceMetadata?.alias ??
        (parsed.name ? (parsed.original_name ?? undefined) : undefined) ??
        undefined;

      if (!alias && !finalName && !deviceId) continue;

      result[parsed.entity_id] = {
        deviceId,
        alias,
        name: finalName,
        avatarUrl,
        initials,
      };
    }

    return result;
  }
}
