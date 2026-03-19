import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHaSubscription, IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { INotificationService } from '../interfaces/INotificationService';
import type { HaEntityState, HaStateChangedEventData } from '../types/home-assistant';
import type { NotificationContent, NotificationStreamRecord } from '../types/notifications';

type PersistentNotificationUpdateType = 'current' | 'added' | 'removed' | 'updated';

type PersistentNotificationPayload = {
  message?: unknown;
  notification_id?: unknown;
  title?: unknown;
};

type PersistentNotificationUpdateEvent = {
  type?: unknown;
  notifications?: Record<string, PersistentNotificationPayload>;
};

type HaEntityRegistryEntry = {
  entity_id?: unknown;
  device_id?: unknown;
  area_id?: unknown;
  labels?: unknown;
};

type HaDeviceRegistryEntry = {
  id?: unknown;
  area_id?: unknown;
  labels?: unknown;
};

type RegistryEntityMeta = {
  deviceId?: string;
  areaId?: string;
  labels: Set<string>;
};

type RegistryDeviceMeta = {
  areaId?: string;
  labels: Set<string>;
};

type RegistrySnapshot = {
  entitiesById: Map<string, RegistryEntityMeta>;
  devicesById: Map<string, RegistryDeviceMeta>;
};

type SourceRegistryProfile = {
  areaId?: string;
  labelIds: Set<string>;
};

const CAMERA_EVENT_TOAST_TTL_MS = 60_000;
const CAMERA_DETECTION_EVENT_KEYWORDS = ['person', 'vehicle', 'animal', 'package'];
const BURST_DEDUPE_WINDOW_MS = 1_500;
const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000;

const parseBurstDedupeWindowMs = (): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_BURST_DEDUPE_WINDOW_MS;
  const parsed = Number(raw ?? BURST_DEDUPE_WINDOW_MS);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return BURST_DEDUPE_WINDOW_MS;
  }

  return Math.floor(parsed);
};

const DEFAULT_SOURCE_COOLDOWN_MS = 0;

const parseSourceCooldownMs = (): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SOURCE_COOLDOWN_MS;
  const parsed = Number(raw ?? DEFAULT_SOURCE_COOLDOWN_MS);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_SOURCE_COOLDOWN_MS;
  }

  return Math.floor(parsed);
};

const parseSourceCooldownAlertMs = (fallback: number): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SOURCE_COOLDOWN_ALERT_MS;
  const parsed = Number(raw ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const parseSourceCooldownEventMs = (fallback: number): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SOURCE_COOLDOWN_EVENT_MS;
  const parsed = Number(raw ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const DEFAULT_SEVERITY_COOLDOWN_MS = 0;

const parseSeverityCooldownInfoMs = (fallback: number): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_INFO_MS;
  const parsed = Number(raw ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const parseSeverityCooldownWarningMs = (fallback: number): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_WARNING_MS;
  const parsed = Number(raw ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const parseSeverityCooldownCriticalMs = (fallback: number): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_SEVERITY_COOLDOWN_CRITICAL_MS;
  const parsed = Number(raw ?? fallback);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

@injectable()
export class HomeAssistantNotificationService implements INotificationService {
  private readonly handlers = new Set<(record: NotificationStreamRecord) => void>();
  private readonly lastPersistentFingerprintByDedupeKey = new Map<string, string>();
  private readonly recentToastFingerprintByDedupeKey = new Map<
    string,
    { fingerprint: string; at: number }
  >();
  private readonly burstDedupeWindowMs = parseBurstDedupeWindowMs();
  private readonly sourceCooldownMs = parseSourceCooldownMs();
  private readonly sourceCooldownAlertMs = parseSourceCooldownAlertMs(this.sourceCooldownMs);
  private readonly sourceCooldownEventMs = parseSourceCooldownEventMs(this.sourceCooldownMs);
  private readonly severityCooldownInfoMs = parseSeverityCooldownInfoMs(
    DEFAULT_SEVERITY_COOLDOWN_MS
  );
  private readonly severityCooldownWarningMs = parseSeverityCooldownWarningMs(
    DEFAULT_SEVERITY_COOLDOWN_MS
  );
  private readonly severityCooldownCriticalMs = parseSeverityCooldownCriticalMs(
    DEFAULT_SEVERITY_COOLDOWN_MS
  );
  private readonly maxSourceCooldownMs = Math.max(
    this.sourceCooldownMs,
    this.sourceCooldownAlertMs,
    this.sourceCooldownEventMs,
    this.severityCooldownInfoMs,
    this.severityCooldownWarningMs,
    this.severityCooldownCriticalMs
  );
  private readonly recentToastBySourceKey = new Map<string, number>();
  private registrySnapshot: RegistrySnapshot | null = null;
  private registrySnapshotFetchedAt = 0;
  private registrySnapshotInFlight: Promise<void> | null = null;

  private persistentSubscription: IHaSubscription | null = null;
  private stateChangedSubscription: IHaSubscription | null = null;
  private subscribePromise: Promise<void> | null = null;

  constructor(
    @inject(TYPES.IHomeAssistantClient) private readonly haClient: IHomeAssistantClient
  ) {}

  async subscribe(handler: (record: NotificationStreamRecord) => void): Promise<IHaSubscription> {
    this.handlers.add(handler);
    await this.ensureUpstreamSubscriptions();

    return {
      unsubscribe: async () => {
        this.handlers.delete(handler);

        if (this.handlers.size > 0) return;

        if (this.subscribePromise) {
          try {
            await this.subscribePromise;
          } catch {
            // ignore
          }
        }

        const persistent = this.persistentSubscription;
        const stateChanged = this.stateChangedSubscription;
        this.persistentSubscription = null;
        this.stateChangedSubscription = null;
        this.resetDedupeState();

        await Promise.allSettled([
          persistent?.unsubscribe() ?? Promise.resolve(),
          stateChanged?.unsubscribe() ?? Promise.resolve(),
        ]);
      },
    };
  }

  private async ensureUpstreamSubscriptions(): Promise<void> {
    if (this.persistentSubscription && this.stateChangedSubscription) return;
    if (this.subscribePromise) return this.subscribePromise;

    this.subscribePromise = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          if (!this.haClient.isConnected()) {
            await this.haClient.connect();
          }

          await this.primeRegistrySnapshotIfNeeded();

          if (!this.persistentSubscription) {
            if (!this.haClient.subscribeToCommandStream) {
              throw new Error('subscribeToCommandStream is not supported by this client');
            }

            this.persistentSubscription = await this.haClient.subscribeToCommandStream(
              { type: 'persistent_notification/subscribe' },
              (event: PersistentNotificationUpdateEvent) => {
                this.handlePersistentNotificationUpdate(event);
              }
            );
          }

          if (!this.stateChangedSubscription) {
            this.stateChangedSubscription =
              await this.haClient.subscribeToEvents<HaStateChangedEventData>(
                'state_changed',
                (event) => {
                  this.handleStateChangedEvent(event.data);
                }
              );
          }

          if (this.handlers.size === 0) {
            const persistent = this.persistentSubscription;
            const stateChanged = this.stateChangedSubscription;
            this.persistentSubscription = null;
            this.stateChangedSubscription = null;
            this.resetDedupeState();

            await Promise.allSettled([
              persistent?.unsubscribe() ?? Promise.resolve(),
              stateChanged?.unsubscribe() ?? Promise.resolve(),
            ]);
          }

          return;
        } catch (error) {
          if (attempt === 0 && this.isRetryableDisconnectError(error)) {
            continue;
          }
          throw error;
        }
      }

      throw new Error('Failed to subscribe to Home Assistant notification streams.');
    })();

    try {
      await this.subscribePromise;
    } finally {
      this.subscribePromise = null;
    }
  }

  private handlePersistentNotificationUpdate(event: PersistentNotificationUpdateEvent): void {
    const updateType = this.asPersistentUpdateType(event.type);
    if (!updateType) return;

    const notifications = event.notifications;
    if (!notifications || typeof notifications !== 'object') return;

    for (const [key, value] of Object.entries(notifications)) {
      const notificationId =
        typeof value?.notification_id === 'string' && value.notification_id.length > 0
          ? value.notification_id
          : key;

      const dedupeKey = `ha:persistent:${notificationId}`;

      if (updateType === 'removed') {
        this.lastPersistentFingerprintByDedupeKey.delete(dedupeKey);

        this.emit({
          surface: 'persistent',
          sourceKind: 'persistent_notification',
          source: 'persistent_notification.removed',
          dedupeKey,
          content: {
            body: '',
            format: 'text',
          },
          remove: true,
        });
        continue;
      }

      const body = this.toText(value?.message);
      if (!body) continue;

      const content: NotificationContent = {
        title: this.toOptionalText(value?.title),
        body,
        format: this.inferContentFormat(body),
      };

      const persistentFingerprint = this.stableSerialize(content);
      if (this.lastPersistentFingerprintByDedupeKey.get(dedupeKey) === persistentFingerprint) {
        continue;
      }

      this.lastPersistentFingerprintByDedupeKey.set(dedupeKey, persistentFingerprint);

      this.emit({
        surface: 'persistent',
        sourceKind: 'persistent_notification',
        source: `persistent_notification.${updateType}`,
        dedupeKey,
        content,
      });
    }
  }

  private handleStateChangedEvent(data: HaStateChangedEventData): void {
    const entityId = data?.entity_id;
    if (!entityId) return;

    if (entityId.startsWith('alert.')) {
      this.handleAlertStateChange(data.old_state, data.new_state);
      return;
    }

    if (entityId.startsWith('event.')) {
      this.handleEventEntityStateChange(data.new_state);
      return;
    }

    if (entityId.startsWith('binary_sensor.')) {
      this.handleBinarySensorStateChange(data.old_state, data.new_state);
    }
  }

  private handleBinarySensorStateChange(
    oldState: HaEntityState | null,
    newState: HaEntityState | null
  ): void {
    if (!newState) return;

    const attrs = (newState.attributes ?? {}) as Record<string, unknown>;
    const previous = String(oldState?.state ?? '')
      .trim()
      .toLowerCase();
    const current = String(newState.state ?? '')
      .trim()
      .toLowerCase();

    if (current === previous) return;
    if (current !== 'on') return;

    const inferredEventType = this.inferBinarySensorEventType(newState.entity_id, attrs);
    if (!inferredEventType) return;
    if (!this.isSupportedCameraDetectionEventType(inferredEventType)) return;

    const cameraEntityId = this.resolveCameraEntityId(newState.entity_id, attrs);
    const label = this.getDisplayName(attrs, newState.entity_id);

    this.emit({
      surface: 'toast',
      sourceKind: 'event_entity',
      source: 'binary_sensor.state_changed',
      dedupeKey: `ha:binary_sensor:${newState.entity_id}:${inferredEventType}:${current}`,
      severity: 'warning',
      ttlMs: CAMERA_EVENT_TOAST_TTL_MS,
      action: cameraEntityId
        ? {
            type: 'open-camera',
            payload: {
              cameraEntityId,
              focusPanel: 'cameras',
              eventType: inferredEventType,
              sourceEntityId: newState.entity_id,
            },
          }
        : {
            type: 'focus-panel',
            payload: {
              panel: 'cameras',
              eventType: inferredEventType,
              sourceEntityId: newState.entity_id,
            },
          },
      content: {
        title: label,
        body: `Event detected: ${inferredEventType}`,
        format: 'text',
      },
    });
  }

  private handleAlertStateChange(
    oldState: HaEntityState | null,
    newState: HaEntityState | null
  ): void {
    if (!newState) return;

    const previous = String(oldState?.state ?? '')
      .trim()
      .toLowerCase();
    const current = String(newState.state ?? '')
      .trim()
      .toLowerCase();

    if (current === previous) return;
    if (current !== 'on' && current !== 'off' && current !== 'idle') return;

    const entityId = newState.entity_id;
    const label = this.getDisplayName(newState.attributes, entityId);

    this.emit({
      surface: 'toast',
      sourceKind: 'alert_state',
      source: 'alert.state_changed',
      dedupeKey: `ha:alert:${entityId}:${current}`,
      severity: current === 'on' ? 'warning' : 'info',
      content: {
        title: current === 'on' ? 'Alert Triggered' : 'Alert Cleared',
        body: `${label} is now ${current.toUpperCase()}.`,
        format: 'text',
      },
    });
  }

  private handleEventEntityStateChange(newState: HaEntityState | null): void {
    if (!newState) return;

    const attrs = (newState.attributes ?? {}) as Record<string, unknown>;
    const eventType =
      typeof attrs.event_type === 'string' && attrs.event_type.trim().length > 0
        ? attrs.event_type.trim()
        : String(newState.state ?? '').trim();

    if (!eventType) return;
    if (!this.isSupportedCameraDetectionEventType(eventType)) return;

    const resolvedCameraEntityId = this.resolveCameraEntityId(newState.entity_id, attrs);

    const cameraContext = newState.entity_id.includes('camera') || !!resolvedCameraEntityId;
    if (!cameraContext) return;

    const label = this.getDisplayName(attrs, newState.entity_id);
    const action = this.resolveActionForEventEntity(
      newState.entity_id,
      eventType,
      attrs,
      resolvedCameraEntityId
    );

    this.emit({
      surface: 'toast',
      sourceKind: 'event_entity',
      source: 'event.state_changed',
      dedupeKey: `ha:event:${newState.entity_id}:${eventType}:${newState.last_updated}`,
      severity: 'info',
      ttlMs: action ? CAMERA_EVENT_TOAST_TTL_MS : undefined,
      action,
      content: {
        title: label,
        body: `Event detected: ${eventType}`,
        format: 'text',
      },
    });
  }

  private emit(record: NotificationStreamRecord): void {
    if (this.shouldSuppressBurstDuplicate(record)) {
      return;
    }

    if (this.shouldSuppressBySourceCooldown(record)) {
      return;
    }

    const snapshot = Array.from(this.handlers);
    for (const handler of snapshot) {
      try {
        handler(record);
      } catch {
        // Never let a consumer break the ingestion pipeline.
      }
    }
  }

  private isRetryableDisconnectError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.trim().toLowerCase();
    return (
      msg === 'websocket disconnected' ||
      msg === 'websocket is not connected' ||
      msg === 'home assistant client is not connected'
    );
  }

  private asPersistentUpdateType(value: unknown): PersistentNotificationUpdateType | null {
    if (value === 'current' || value === 'added' || value === 'removed' || value === 'updated') {
      return value;
    }
    return null;
  }

  private toText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private inferContentFormat(body: string): NotificationContent['format'] {
    const hasTag = /<\/?[a-z][^>]*>/i.test(body);
    if (hasTag) return 'html';

    const hasMarkdown = /\*\*.+\*\*|\*.+\*|`.+`/.test(body);
    return hasMarkdown ? 'markdown' : 'text';
  }

  private getDisplayName(attrs: Record<string, unknown>, fallback: string): string {
    const friendlyName = typeof attrs.friendly_name === 'string' ? attrs.friendly_name.trim() : '';
    if (friendlyName.length > 0) return friendlyName;

    const name = typeof attrs.name === 'string' ? attrs.name.trim() : '';
    if (name.length > 0) return name;

    return fallback;
  }

  private resolveActionForEventEntity(
    entityId: string,
    eventType: string,
    attrs: Record<string, unknown>,
    resolvedCameraEntityId?: string
  ): NotificationStreamRecord['action'] {
    if (!this.isSupportedCameraDetectionEventType(eventType)) return undefined;

    const cameraEntityId = resolvedCameraEntityId ?? this.resolveCameraEntityId(entityId, attrs);

    if (cameraEntityId && cameraEntityId.startsWith('camera.')) {
      return {
        type: 'open-camera',
        payload: {
          cameraEntityId,
          focusPanel: 'cameras',
          eventType,
          sourceEntityId: entityId,
        },
      };
    }

    return {
      type: 'focus-panel',
      payload: {
        panel: 'cameras',
        eventType,
        sourceEntityId: entityId,
      },
    };
  }

  private resolveCameraEntityId(
    entityId: string,
    attrs: Record<string, unknown>
  ): string | undefined {
    this.maybeRefreshRegistrySnapshotInBackground();

    const scoredCandidates = new Map<string, number>();

    const addCandidates = (value: unknown, baseScore: number): void => {
      for (const candidate of this.normalizeCameraCandidates(value)) {
        const prev = scoredCandidates.get(candidate) ?? Number.NEGATIVE_INFINITY;
        if (baseScore > prev) {
          scoredCandidates.set(candidate, baseScore);
        }
      }
    };

    addCandidates(attrs.camera_entity_id, 100);
    addCandidates(attrs.cameraEntityId, 95);
    addCandidates(attrs.camera_entity, 95);
    addCandidates(attrs.camera_entity_ids, 92);
    addCandidates(attrs.camera_entities, 92);
    addCandidates(attrs.cameras, 90);
    addCandidates(attrs.entity_id, 85);
    addCandidates(attrs.source_entity_id, 78);
    addCandidates(attrs.trigger_entity_id, 76);
    addCandidates(attrs.related_entity_id, 74);
    addCandidates(attrs.object_entity_id, 72);
    addCandidates(entityId, 70);

    if (scoredCandidates.size === 0) return undefined;

    const contextTokens = this.extractCameraContextTokens(attrs, entityId);
    const sourceRegistryProfile = this.resolveSourceRegistryProfile(entityId, attrs);
    let best: { cameraEntityId: string; score: number } | null = null;

    for (const [cameraEntityId, baseScore] of scoredCandidates.entries()) {
      const candidateTokens = this.toComparableTokens(cameraEntityId);
      let score = baseScore;

      if (contextTokens.length > 0) {
        for (const token of contextTokens) {
          if (candidateTokens.has(token)) {
            score += 3;
          }
        }
      }

      score += this.getRegistryCameraCandidateBonus(cameraEntityId, sourceRegistryProfile);

      if (
        !best ||
        score > best.score ||
        (score === best.score && cameraEntityId < best.cameraEntityId)
      ) {
        best = { cameraEntityId, score };
      }
    }

    return best?.cameraEntityId;
  }

  private normalizeCameraCandidates(value: unknown): string[] {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return [];

      if (trimmed.startsWith('camera.')) {
        return [trimmed];
      }

      if (trimmed.startsWith('binary_sensor.') || trimmed.startsWith('event.')) {
        return this.inferCameraCandidatesFromSourceEntityId(trimmed);
      }

      return [];
    }

    if (Array.isArray(value)) {
      const merged = new Set<string>();
      for (const item of value) {
        for (const candidate of this.normalizeCameraCandidates(item)) {
          merged.add(candidate);
        }
      }
      return Array.from(merged);
    }

    return [];
  }

  private inferCameraCandidatesFromSourceEntityId(sourceEntityId: string): string[] {
    const candidates = new Set<string>();

    if (sourceEntityId.startsWith('camera.')) {
      candidates.add(sourceEntityId);
    }

    if (sourceEntityId.startsWith('binary_sensor.')) {
      const rawName = sourceEntityId.slice('binary_sensor.'.length);
      const suffixes = ['_person', '_vehicle', '_animal', '_package', '_motion'];

      for (const suffix of suffixes) {
        if (!rawName.endsWith(suffix)) continue;

        const base = rawName.slice(0, -suffix.length);
        if (!base) continue;

        candidates.add(`camera.${base}`);

        if (base.endsWith('_camera')) {
          const stem = base.slice(0, -'_camera'.length);
          if (stem) {
            candidates.add(`camera.${stem}`);
          }
        }
      }
    }

    if (sourceEntityId.startsWith('event.')) {
      const rawName = sourceEntityId.slice('event.'.length);
      if (this.hasCameraHint(rawName)) {
        candidates.add(`camera.${rawName}`);
      }

      if (rawName.endsWith('_camera')) {
        const stem = rawName.slice(0, -'_camera'.length);
        if (stem) {
          candidates.add(`camera.${stem}`);
        }
      }
    }

    return Array.from(candidates);
  }

  private extractCameraContextTokens(attrs: Record<string, unknown>, entityId: string): string[] {
    const tokenSources: unknown[] = [
      entityId,
      attrs.area_id,
      attrs.area_ids,
      attrs.area_name,
      attrs.area,
      attrs.room,
      attrs.zone,
      attrs.label_id,
      attrs.label_ids,
      attrs.labels,
      attrs.tags,
      attrs.friendly_name,
      attrs.name,
      attrs.event_type,
    ];

    const tokenSet = new Set<string>();
    for (const source of tokenSources) {
      for (const token of this.tokensFromUnknown(source)) {
        tokenSet.add(token);
      }
    }

    return Array.from(tokenSet);
  }

  private tokensFromUnknown(value: unknown): string[] {
    if (typeof value === 'string') {
      return this.toTokenList(value);
    }

    if (Array.isArray(value)) {
      const tokens = new Set<string>();
      for (const entry of value) {
        for (const token of this.tokensFromUnknown(entry)) {
          tokens.add(token);
        }
      }
      return Array.from(tokens);
    }

    return [];
  }

  private toTokenList(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
  }

  private toComparableTokens(value: string): Set<string> {
    return new Set(this.toTokenList(value));
  }

  private hasCameraHint(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;

    return normalized.includes('camera') || normalized.endsWith('_cam');
  }

  private maybeRefreshRegistrySnapshotInBackground(): void {
    if (!this.registrySnapshot) return;
    if (this.registrySnapshotInFlight) return;

    const now = Date.now();
    if (now - this.registrySnapshotFetchedAt < REGISTRY_CACHE_TTL_MS) {
      return;
    }

    void this.primeRegistrySnapshotIfNeeded();
  }

  private async primeRegistrySnapshotIfNeeded(): Promise<void> {
    const hasEntityRegistry = typeof this.haClient.getEntityRegistry === 'function';
    const hasDeviceRegistry = typeof this.haClient.getDeviceRegistry === 'function';

    if (!hasEntityRegistry || !hasDeviceRegistry) {
      return;
    }

    const now = Date.now();
    if (this.registrySnapshot && now - this.registrySnapshotFetchedAt < REGISTRY_CACHE_TTL_MS) {
      return;
    }

    if (this.registrySnapshotInFlight) {
      return this.registrySnapshotInFlight;
    }

    this.registrySnapshotInFlight = (async () => {
      try {
        const [entityRegistryRaw, deviceRegistryRaw] = await Promise.all([
          this.haClient.getEntityRegistry!(),
          this.haClient.getDeviceRegistry!(),
        ]);

        const entityRegistry = Array.isArray(entityRegistryRaw) ? entityRegistryRaw : [];
        const deviceRegistry = Array.isArray(deviceRegistryRaw) ? deviceRegistryRaw : [];

        const devicesById = new Map<string, RegistryDeviceMeta>();
        for (const entry of deviceRegistry as HaDeviceRegistryEntry[]) {
          const id = this.normalizeNonEmptyString(entry?.id);
          if (!id) continue;

          devicesById.set(id, {
            areaId: this.normalizeNonEmptyString(entry?.area_id) ?? undefined,
            labels: this.normalizeStringSet(entry?.labels),
          });
        }

        const entitiesById = new Map<string, RegistryEntityMeta>();
        for (const entry of entityRegistry as HaEntityRegistryEntry[]) {
          const entityId = this.normalizeNonEmptyString(entry?.entity_id);
          if (!entityId) continue;

          entitiesById.set(entityId, {
            deviceId: this.normalizeNonEmptyString(entry?.device_id) ?? undefined,
            areaId: this.normalizeNonEmptyString(entry?.area_id) ?? undefined,
            labels: this.normalizeStringSet(entry?.labels),
          });
        }

        this.registrySnapshot = { entitiesById, devicesById };
        this.registrySnapshotFetchedAt = Date.now();
      } catch {
        // Registry enrichment is best-effort and should never block notifications.
      } finally {
        this.registrySnapshotInFlight = null;
      }
    })();

    return this.registrySnapshotInFlight;
  }

  private resolveSourceRegistryProfile(
    entityId: string,
    attrs: Record<string, unknown>
  ): SourceRegistryProfile | null {
    const snapshot = this.registrySnapshot;
    if (!snapshot) return null;

    const sourceIds = this.extractSourceEntityIdsForRegistry(entityId, attrs);
    if (sourceIds.length === 0) return null;

    let resolvedAreaId: string | undefined;
    const labelIds = new Set<string>();

    for (const sourceId of sourceIds) {
      const meta = this.resolveRegistryEntityMeta(sourceId, snapshot);
      if (!meta) continue;

      if (!resolvedAreaId && meta.areaId) {
        resolvedAreaId = meta.areaId;
      }

      for (const labelId of meta.labels) {
        labelIds.add(labelId);
      }
    }

    if (!resolvedAreaId && labelIds.size === 0) {
      return null;
    }

    return { areaId: resolvedAreaId, labelIds };
  }

  private extractSourceEntityIdsForRegistry(
    entityId: string,
    attrs: Record<string, unknown>
  ): string[] {
    const candidateSources: unknown[] = [
      attrs.source_entity_id,
      attrs.trigger_entity_id,
      attrs.related_entity_id,
      attrs.object_entity_id,
      attrs.entity_id,
      entityId,
    ];

    const ordered = new Set<string>();
    for (const source of candidateSources) {
      for (const candidate of this.extractStringCandidates(source)) {
        ordered.add(candidate);
      }
    }

    return Array.from(ordered);
  }

  private extractStringCandidates(value: unknown): string[] {
    if (typeof value === 'string') {
      const normalized = this.normalizeNonEmptyString(value);
      return normalized ? [normalized] : [];
    }

    if (Array.isArray(value)) {
      const values = new Set<string>();
      for (const entry of value) {
        for (const candidate of this.extractStringCandidates(entry)) {
          values.add(candidate);
        }
      }
      return Array.from(values);
    }

    return [];
  }

  private getRegistryCameraCandidateBonus(
    cameraEntityId: string,
    sourceProfile: SourceRegistryProfile | null
  ): number {
    if (!sourceProfile || (sourceProfile.labelIds.size === 0 && !sourceProfile.areaId)) {
      return 0;
    }

    const snapshot = this.registrySnapshot;
    if (!snapshot) return 0;

    const cameraMeta = this.resolveRegistryEntityMeta(cameraEntityId, snapshot);
    if (!cameraMeta) return 0;

    let bonus = 0;

    if (sourceProfile.areaId && cameraMeta.areaId && sourceProfile.areaId === cameraMeta.areaId) {
      bonus += 35;
    }

    if (sourceProfile.labelIds.size > 0 && cameraMeta.labels.size > 0) {
      let shared = 0;
      for (const labelId of sourceProfile.labelIds) {
        if (cameraMeta.labels.has(labelId)) {
          shared += 1;
        }
      }
      bonus += Math.min(shared * 8, 24);
    }

    return bonus;
  }

  private resolveRegistryEntityMeta(
    entityId: string,
    snapshot: RegistrySnapshot
  ): { areaId?: string; labels: Set<string> } | null {
    const entityMeta = snapshot.entitiesById.get(entityId);
    if (!entityMeta) return null;

    const mergedLabels = new Set(entityMeta.labels);
    let areaId = entityMeta.areaId;

    if (entityMeta.deviceId) {
      const deviceMeta = snapshot.devicesById.get(entityMeta.deviceId);
      if (deviceMeta) {
        if (!areaId && deviceMeta.areaId) {
          areaId = deviceMeta.areaId;
        }

        for (const labelId of deviceMeta.labels) {
          mergedLabels.add(labelId);
        }
      }
    }

    return {
      areaId,
      labels: mergedLabels,
    };
  }

  private normalizeNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringSet(value: unknown): Set<string> {
    const set = new Set<string>();
    if (!Array.isArray(value)) {
      return set;
    }

    for (const entry of value) {
      const normalized = this.normalizeNonEmptyString(entry);
      if (normalized) {
        set.add(normalized);
      }
    }

    return set;
  }

  private inferBinarySensorEventType(
    entityId: string,
    attrs: Record<string, unknown>
  ): string | undefined {
    const explicitEventType = this.toOptionalText(attrs.event_type);
    if (explicitEventType) return explicitEventType;

    const classifier = `${entityId} ${this.toOptionalText(attrs.device_class) ?? ''}`.toLowerCase();
    if (classifier.includes('person')) return 'person_detected';
    if (classifier.includes('vehicle')) return 'vehicle_detected';
    if (classifier.includes('animal')) return 'animal_detected';
    if (classifier.includes('package')) return 'package_detected';

    return undefined;
  }

  private isSupportedCameraDetectionEventType(eventType: string): boolean {
    const normalized = eventType.trim().toLowerCase();
    return CAMERA_DETECTION_EVENT_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  private resetDedupeState(): void {
    this.lastPersistentFingerprintByDedupeKey.clear();
    this.recentToastFingerprintByDedupeKey.clear();
    this.recentToastBySourceKey.clear();
  }

  private shouldSuppressBurstDuplicate(record: NotificationStreamRecord): boolean {
    if (record.surface !== 'toast') return false;
    if (this.burstDedupeWindowMs <= 0) return false;

    const now = Date.now();
    this.pruneToastBurstFingerprintWindow(now);

    const fingerprint = this.stableSerialize({
      dedupeKey: record.dedupeKey,
      source: record.source,
      severity: record.severity,
      content: record.content,
      action: record.action,
      remove: record.remove === true,
    });

    const existing = this.recentToastFingerprintByDedupeKey.get(record.dedupeKey);
    this.recentToastFingerprintByDedupeKey.set(record.dedupeKey, { fingerprint, at: now });

    if (!existing) return false;
    if (existing.fingerprint !== fingerprint) return false;

    return now - existing.at <= this.burstDedupeWindowMs;
  }

  private pruneToastBurstFingerprintWindow(now: number): void {
    const cutoff = now - this.burstDedupeWindowMs;
    for (const [dedupeKey, entry] of this.recentToastFingerprintByDedupeKey.entries()) {
      if (entry.at < cutoff) {
        this.recentToastFingerprintByDedupeKey.delete(dedupeKey);
      }
    }
  }

  private stableSerialize(value: unknown): string {
    return JSON.stringify(this.sortForStableSerialization(value));
  }

  private shouldSuppressBySourceCooldown(record: NotificationStreamRecord): boolean {
    if (record.surface !== 'toast') return false;
    const cooldownMs = this.getEffectiveCooldownMs(record);
    if (cooldownMs <= 0) return false;

    const now = Date.now();
    this.pruneSourceCooldownWindow(now);

    const sourceKey = this.deriveSourceCooldownKey(record);
    const lastSeenAt = this.recentToastBySourceKey.get(sourceKey);
    this.recentToastBySourceKey.set(sourceKey, now);

    if (lastSeenAt === undefined) return false;
    return now - lastSeenAt <= cooldownMs;
  }

  private getSourceCooldownMs(record: NotificationStreamRecord): number {
    if (record.surface !== 'toast') return 0;

    if (record.sourceKind === 'alert_state') {
      return this.sourceCooldownAlertMs;
    }

    if (record.sourceKind === 'event_entity') {
      return this.sourceCooldownEventMs;
    }

    return this.sourceCooldownMs;
  }

  private getSeverityCooldownMs(record: NotificationStreamRecord): number {
    if (record.surface !== 'toast') return 0;

    if (record.severity === 'critical') {
      return this.severityCooldownCriticalMs;
    }

    if (record.severity === 'warning') {
      return this.severityCooldownWarningMs;
    }

    if (record.severity === 'info') {
      return this.severityCooldownInfoMs;
    }

    return 0;
  }

  private getEffectiveCooldownMs(record: NotificationStreamRecord): number {
    return Math.max(this.getSourceCooldownMs(record), this.getSeverityCooldownMs(record));
  }

  private deriveSourceCooldownKey(record: NotificationStreamRecord): string {
    if (record.surface !== 'toast') return record.dedupeKey;

    if (record.sourceKind === 'alert_state') {
      return this.extractAlertSourceKey(record.dedupeKey);
    }

    if (record.sourceKind === 'event_entity') {
      return this.extractEventSourceKey(record.dedupeKey);
    }

    return record.dedupeKey;
  }

  private pruneSourceCooldownWindow(now: number): void {
    if (this.maxSourceCooldownMs <= 0) {
      this.recentToastBySourceKey.clear();
      return;
    }

    const cutoff = now - this.maxSourceCooldownMs;
    for (const [sourceKey, seenAt] of this.recentToastBySourceKey.entries()) {
      if (seenAt < cutoff) {
        this.recentToastBySourceKey.delete(sourceKey);
      }
    }
  }

  private extractAlertSourceKey(dedupeKey: string): string {
    const parts = dedupeKey.split(':');
    if (parts.length < 3) return dedupeKey;
    return parts.slice(0, 3).join(':');
  }

  private extractEventSourceKey(dedupeKey: string): string {
    const parts = dedupeKey.split(':');
    if (parts.length < 4) return dedupeKey;
    return parts.slice(0, 4).join(':');
  }

  private sortForStableSerialization(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortForStableSerialization(item));
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
      );

      return Object.fromEntries(
        entries.map(([key, item]) => [key, this.sortForStableSerialization(item)])
      );
    }

    return value;
  }
}
