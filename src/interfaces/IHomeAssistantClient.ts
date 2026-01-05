import type {
  HaCallServiceParams,
  HaCallServiceResult,
  HaEntityId,
  HaEntityState,
  HaEvent,
  HaRestServicesDomain,
} from '../types/home-assistant';

export interface IHaSubscription {
  unsubscribe(): Promise<void>;
}

/**
 * Home Assistant Client Interface
 *
 * Abstraction over Home Assistant's WebSocket API for real-time state and service calls.
 * Consumers should generally prefer subscriptions to derive UI state from events.
 */
export interface IHomeAssistantClient {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  getStates(): Promise<HaEntityState[]>;
  getState(entityId: HaEntityId): Promise<HaEntityState | null>;
  getServices(): Promise<HaRestServicesDomain[]>;

  subscribeToEvents<TData>(
    eventType: string | null,
    handler: (event: HaEvent<TData>) => void
  ): Promise<IHaSubscription>;

  callService(params: HaCallServiceParams): Promise<HaCallServiceResult>;
}
