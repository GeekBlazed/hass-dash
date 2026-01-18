import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IHomeAssistantServiceCallQueue } from '../interfaces/IHomeAssistantServiceCallQueue';
import type {
  HaCallServiceParams,
  HaCallServiceResult,
  HaEntityId,
  HaEntityState,
  HaEvent,
  HaRestServicesDomain,
  HaSubscribeTriggerConfig,
  HaTriggerEvent,
} from '../types/home-assistant';

function canUseNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean';
}

function isBrowserOffline(): boolean {
  if (!canUseNavigatorOnline()) return false;
  return navigator.onLine === false;
}

function isRetryableDisconnectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.trim().toLowerCase();
  return (
    msg === 'websocket disconnected' ||
    msg === 'websocket is not connected' ||
    msg === 'home assistant client is not connected'
  );
}

function createQueuedResult(): HaCallServiceResult {
  const now = Date.now();
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `queued-${now}-${Math.random().toString(16).slice(2)}`;

  return {
    context: {
      id,
      parent_id: null,
      user_id: null,
    },
    response: {
      queued: true,
    },
  };
}

@injectable()
export class QueuedHomeAssistantClient implements IHomeAssistantClient {
  constructor(
    @inject(TYPES.IHomeAssistantClientRaw)
    private readonly raw: IHomeAssistantClient,
    @inject(TYPES.IHomeAssistantServiceCallQueue)
    private readonly queue: IHomeAssistantServiceCallQueue
  ) {}

  connect(): Promise<void> {
    return this.raw.connect();
  }

  connectWithConfig(config: HomeAssistantConnectionConfig): Promise<void> {
    if (this.raw.connectWithConfig) {
      return this.raw.connectWithConfig(config);
    }

    // Fall back to a normal connect if the underlying client doesn't support
    // config-scoped connection attempts.
    return this.raw.connect();
  }

  disconnect(): void {
    this.raw.disconnect();
  }

  isConnected(): boolean {
    return this.raw.isConnected();
  }

  getStates(): Promise<HaEntityState[]> {
    return this.raw.getStates();
  }

  getState(entityId: HaEntityId): Promise<HaEntityState | null> {
    return this.raw.getState(entityId);
  }

  getServices(): Promise<HaRestServicesDomain[]> {
    return this.raw.getServices();
  }

  subscribeToEvents<TData>(
    eventType: string | null,
    handler: (event: HaEvent<TData>) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    return this.raw.subscribeToEvents(eventType, handler);
  }

  subscribeToTrigger(
    trigger: HaSubscribeTriggerConfig,
    handler: (event: HaTriggerEvent) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    if (!this.raw.subscribeToTrigger) {
      return Promise.reject(new Error('subscribeToTrigger is not supported by this client'));
    }

    return this.raw.subscribeToTrigger(trigger, handler);
  }

  async callService(params: HaCallServiceParams): Promise<HaCallServiceResult> {
    if (isBrowserOffline()) {
      await this.queue.enqueue(params);
      return createQueuedResult();
    }

    try {
      return await this.raw.callService(params);
    } catch (error: unknown) {
      if (isRetryableDisconnectError(error)) {
        await this.queue.enqueue(params);
        return createQueuedResult();
      }
      throw error;
    }
  }

  getEntityRegistry(): Promise<unknown[]> {
    if (!this.raw.getEntityRegistry) {
      return Promise.reject(new Error('getEntityRegistry is not supported by this client'));
    }
    return this.raw.getEntityRegistry();
  }

  getDeviceRegistry(): Promise<unknown[]> {
    if (!this.raw.getDeviceRegistry) {
      return Promise.reject(new Error('getDeviceRegistry is not supported by this client'));
    }
    return this.raw.getDeviceRegistry();
  }

  getLabelRegistry(): Promise<unknown[]> {
    if (!this.raw.getLabelRegistry) {
      return Promise.reject(new Error('getLabelRegistry is not supported by this client'));
    }
    return this.raw.getLabelRegistry();
  }

  getAreaRegistry(): Promise<unknown[]> {
    if (!this.raw.getAreaRegistry) {
      return Promise.reject(new Error('getAreaRegistry is not supported by this client'));
    }
    return this.raw.getAreaRegistry();
  }
}
