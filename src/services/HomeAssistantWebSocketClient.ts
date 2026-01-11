import { inject, injectable } from 'inversify';
import { TYPES } from '../core/types';
import type { IHaSubscription, IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type {
  HomeAssistantConnectionConfig,
  IHomeAssistantConnectionConfig,
} from '../interfaces/IHomeAssistantConnectionConfig';
import type { IWebSocketService } from '../interfaces/IWebSocketService';
import type {
  HaCallServiceParams,
  HaCallServiceResult,
  HaEntityId,
  HaEntityState,
  HaEvent,
  HaRestServicesDomain,
  HaWsEventMessage,
  HaWsResultMessage,
} from '../types/home-assistant';
import { validateHomeAssistantConnectionConfig } from '../utils/homeAssistantConnectionValidation';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

type SubscriptionHandler = (event: HaEvent<unknown>) => void;

type SubscriptionRecord = {
  eventType: string | null;
  handler: SubscriptionHandler;
};

@injectable()
export class HomeAssistantWebSocketClient implements IHomeAssistantClient {
  private connected = false;
  private nextId = 1;

  private pending = new Map<number, PendingRequest>();
  private subscriptions = new Map<number, SubscriptionRecord>();

  private readonly connectionConfig: IHomeAssistantConnectionConfig;
  private readonly webSocketService: IWebSocketService;

  constructor(
    @inject(TYPES.IHomeAssistantConnectionConfig)
    connectionConfig: IHomeAssistantConnectionConfig,
    @inject(TYPES.IWebSocketService)
    webSocketService: IWebSocketService
  ) {
    this.connectionConfig = connectionConfig;
    this.webSocketService = webSocketService;

    this.webSocketService.subscribe((data) => {
      this.handleMessageData(data);
    });

    this.webSocketService.subscribeConnectionStatus((connected) => {
      this.handleConnectionStatusChange(connected);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const wsUrl = this.getWebSocketUrl();
    const token = this.getAccessToken();

    if (!wsUrl) {
      throw new Error('Home Assistant WebSocket URL is not configured (VITE_HA_WEBSOCKET_URL)');
    }

    if (!token) {
      throw new Error('Home Assistant access token is not configured (VITE_HA_ACCESS_TOKEN)');
    }

    await this.connectInternal(wsUrl, token);
  }

  async connectWithConfig(config: HomeAssistantConnectionConfig): Promise<void> {
    if (this.connected) return;

    const validation = validateHomeAssistantConnectionConfig(config);
    if (!validation.isValid) {
      throw new Error(validation.errors[0] ?? 'Invalid Home Assistant configuration');
    }

    const wsUrl = validation.effectiveWebSocketUrl;
    const token = config.accessToken;

    // validation guarantees these
    if (!wsUrl) {
      throw new Error('Home Assistant WebSocket URL is not configured');
    }
    if (!token) {
      throw new Error('Home Assistant access token is not configured');
    }

    await this.connectInternal(wsUrl, token);
  }

  private async connectInternal(wsUrl: string, token: string): Promise<void> {
    await this.webSocketService.connect(wsUrl, token);
  }

  disconnect(): void {
    this.connected = false;
    this.subscriptions.clear();
    this.rejectAllPending(new Error('WebSocket disconnected'));

    this.webSocketService.disconnect();
  }

  async getStates(): Promise<HaEntityState[]> {
    const result = await this.sendCommand({ type: 'get_states' });
    return result as HaEntityState[];
  }

  async getState(entityId: HaEntityId): Promise<HaEntityState | null> {
    const states = await this.getStates();
    return states.find((s) => s.entity_id === entityId) ?? null;
  }

  async getServices(): Promise<HaRestServicesDomain[]> {
    const result = await this.sendCommand({ type: 'get_services' });

    // WebSocket returns a mapping keyed by domain.
    // Normalize into the REST-like array shape we use across the app.
    const servicesByDomain = result as Record<string, { services: Record<string, unknown> }>;

    return Object.entries(servicesByDomain).map(([domain, value]) => ({
      domain,
      services: (value as { services: Record<string, unknown> })
        .services as HaRestServicesDomain['services'],
    }));
  }

  async subscribeToEvents<TData>(
    eventType: string | null,
    handler: (event: HaEvent<TData>) => void
  ): Promise<IHaSubscription> {
    const subscriptionId = this.allocateId();

    const command: Record<string, unknown> = {
      id: subscriptionId,
      type: 'subscribe_events',
    };

    if (eventType) {
      command.event_type = eventType;
    }

    const result = await this.sendRawCommand(subscriptionId, command);

    // subscribe_events returns null in `result` on success.
    void result;

    this.subscriptions.set(subscriptionId, {
      eventType,
      handler: (event) => {
        handler(event as HaEvent<TData>);
      },
    });

    return {
      unsubscribe: async () => {
        this.subscriptions.delete(subscriptionId);
        try {
          await this.sendCommand({
            type: 'unsubscribe_events',
            subscription: subscriptionId,
          });
        } catch {
          // If unsubscribe fails, we still consider it unsubscribed locally.
        }
      },
    };
  }

  async callService(params: HaCallServiceParams): Promise<HaCallServiceResult> {
    const id = this.allocateId();
    const command = {
      id,
      type: 'call_service',
      domain: params.domain,
      service: params.service,
      service_data: params.service_data,
      target: params.target,
      return_response: params.return_response,
    };

    const result = await this.sendRawCommand(id, command);

    // WS call_service responses include a wrapper that can contain `context` and `response`.
    // If return_response is not supported, response may be null.
    return result as HaCallServiceResult;
  }

  async getEntityRegistry(): Promise<unknown[]> {
    const result = await this.sendCommand({ type: 'config/entity_registry/list' });
    return Array.isArray(result) ? result : [];
  }

  async getDeviceRegistry(): Promise<unknown[]> {
    const result = await this.sendCommand({ type: 'config/device_registry/list' });
    return Array.isArray(result) ? result : [];
  }

  /**
   * Resolve the WebSocket endpoint from the connection configuration.
   *
   * URL derivation and normalization (including handling base URLs, paths,
   * protocol switching, and environment-specific differences) are delegated
   * to {@link IHomeAssistantConnectionConfig}. This keeps the WebSocket
   * client focused solely on the Home Assistant WS protocol and avoids
   * coupling it to configuration/URL-building concerns.
   */
  private getWebSocketUrl(): string | undefined {
    return this.connectionConfig.getEffectiveWebSocketUrl();
  }

  /**
   * Retrieve the access token from the connection configuration.
   *
   * Token sourcing and storage are encapsulated in
   * {@link IHomeAssistantConnectionConfig} so that authentication details
   * can evolve independently of the WebSocket transport layer.
   */
  private getAccessToken(): string | undefined {
    return this.connectionConfig.getAccessToken();
  }

  private handleMessageData(data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      return;
    }

    if (this.isWsResult(parsed)) {
      const pending = this.pending.get(parsed.id);
      if (!pending) return;

      this.pending.delete(parsed.id);

      if (parsed.success) {
        pending.resolve(parsed.result);
      } else {
        pending.reject(this.toCommandError(parsed.error));
      }

      return;
    }

    if (this.isWsEvent(parsed)) {
      const subscription = this.subscriptions.get(parsed.id);
      if (subscription) {
        subscription.handler(parsed.event as HaEvent<unknown>);
      }
    }
  }

  private handleConnectionStatusChange(connected: boolean): void {
    if (this.connected === connected) return;
    this.connected = connected;

    if (!connected) {
      this.rejectAllPending(new Error('WebSocket disconnected'));
      return;
    }

    void this.resubscribeAll();
  }

  private async resubscribeAll(): Promise<void> {
    if (!this.connected) return;

    const attempts = Array.from(this.subscriptions.entries(), ([subscriptionId, record]) => {
      const command: Record<string, unknown> = {
        id: subscriptionId,
        type: 'subscribe_events',
      };

      if (record.eventType) {
        command.event_type = record.eventType;
      }

      return this.sendRawCommand(subscriptionId, command);
    });

    const results = await Promise.allSettled(attempts);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        // subscribe_events returns null in `result` on success.
        void result.value;
      }
      // If resubscribe fails, we rely on the transport reconnect loop to retry.
    }
  }

  private toCommandError(error: unknown): Error {
    if (typeof error === 'object' && error !== null) {
      const message = (error as { message?: unknown }).message;
      const code = (error as { code?: unknown }).code;
      const data = (error as { data?: unknown }).data;

      if (typeof message === 'string') {
        const err = new Error(message);
        if (typeof code === 'string') {
          (err as unknown as { code?: string }).code = code;
        }
        if (data !== undefined) {
          (err as unknown as { data?: unknown }).data = data;
        }
        return err;
      }
    }

    if (error instanceof Error) return error;
    return new Error('Home Assistant command failed');
  }

  private rejectAllPending(error: unknown): void {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private allocateId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.webSocketService.isConnected()) {
      throw new Error('Home Assistant client is not connected');
    }
  }

  private async sendCommand(command: Record<string, unknown>): Promise<unknown> {
    const id = this.allocateId();
    return this.sendRawCommand(id, { id, ...command });
  }

  private async sendRawCommand(id: number, command: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();

    const result = await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      try {
        this.webSocketService.send(JSON.stringify(command));
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });

    return result;
  }

  private isWsResult(message: unknown): message is HaWsResultMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'result' &&
      typeof (message as { id?: unknown }).id === 'number'
    );
  }

  private isWsEvent(message: unknown): message is HaWsEventMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'event' &&
      typeof (message as { id?: unknown }).id === 'number'
    );
  }
}
