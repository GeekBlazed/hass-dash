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

@injectable()
export class HomeAssistantNotificationService implements INotificationService {
  private readonly handlers = new Set<(record: NotificationStreamRecord) => void>();

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

      this.emit({
        surface: 'persistent',
        sourceKind: 'persistent_notification',
        source: `persistent_notification.${updateType}`,
        dedupeKey,
        content: {
          title: this.toOptionalText(value?.title),
          body,
          format: this.inferContentFormat(body),
        },
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
    }
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

    const label = this.getDisplayName(attrs, newState.entity_id);
    const action = this.resolveActionForEventEntity(newState.entity_id, eventType, attrs);

    this.emit({
      surface: 'toast',
      sourceKind: 'event_entity',
      source: 'event.state_changed',
      dedupeKey: `ha:event:${newState.entity_id}:${eventType}:${newState.last_updated}`,
      severity: 'info',
      action,
      content: {
        title: label,
        body: `Event detected: ${eventType}`,
        format: 'text',
      },
    });
  }

  private emit(record: NotificationStreamRecord): void {
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
    attrs: Record<string, unknown>
  ): NotificationStreamRecord['action'] {
    const normalizedType = eventType.trim().toLowerCase();

    const looksCameraRelated =
      entityId.startsWith('event.camera_') ||
      entityId.includes('camera') ||
      normalizedType.includes('person') ||
      normalizedType.includes('motion') ||
      normalizedType.includes('vehicle') ||
      normalizedType.includes('package') ||
      normalizedType.includes('animal');

    if (!looksCameraRelated) return undefined;

    const cameraEntityId =
      this.toOptionalText(attrs.camera_entity_id) ??
      this.toOptionalText(attrs.entity_id) ??
      undefined;

    if (cameraEntityId && cameraEntityId.startsWith('camera.')) {
      return {
        type: 'open-camera',
        payload: {
          cameraEntityId,
          focusPanel: 'cameras',
          eventType,
        },
      };
    }

    return {
      type: 'focus-panel',
      payload: {
        panel: 'cameras',
        eventType,
      },
    };
  }
}
