import type {
  HaCallServiceParams,
  HaCallServiceResult,
  HaEntityId,
  HaEntityState,
  HaEvent,
  HaRestServicesDomain,
  HaTriggerEvent,
} from '../types/home-assistant';
import type { HomeAssistantConnectionConfig } from './IHomeAssistantConnectionConfig';

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
  /**
   * Connect using an explicit config without mutating the global connection config service.
   *
   * This is primarily used for dev-only "test connection" flows where the user is editing
   * draft values and we want to avoid persisting overrides if the component unmounts mid-test.
   */
  connectWithConfig?(config: HomeAssistantConnectionConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  getStates(): Promise<HaEntityState[]>;
  getState(entityId: HaEntityId): Promise<HaEntityState | null>;
  getServices(): Promise<HaRestServicesDomain[]>;

  subscribeToEvents<TData>(
    eventType: string | null,
    handler: (event: HaEvent<TData>) => void
  ): Promise<IHaSubscription>;

  /**
   * Optional: Subscribe to triggers via `subscribe_trigger`.
   *
   * This can be used to reduce event volume vs. subscribing to all `state_changed`
   * and filtering client-side.
   */
  subscribeToTrigger?(
    trigger: unknown,
    handler: (event: HaTriggerEvent) => void
  ): Promise<IHaSubscription>;

  callService(params: HaCallServiceParams): Promise<HaCallServiceResult>;

  /**
   * Optional: Fetch entity registry entries via the Home Assistant WebSocket API.
   *
   * Not all client implementations need to support this, but it's preferred for
   * browser-based development because it avoids REST/CORS constraints.
   */
  getEntityRegistry?(): Promise<unknown[]>;

  /**
   * Optional: Fetch device registry entries via the Home Assistant WebSocket API.
   */
  getDeviceRegistry?(): Promise<unknown[]>;

  /**
   * Optional: Fetch label registry entries via the Home Assistant WebSocket API.
   */
  getLabelRegistry?(): Promise<unknown[]>;

  /**
   * Optional: Fetch area registry entries via the Home Assistant WebSocket API.
   */
  getAreaRegistry?(): Promise<unknown[]>;
}
