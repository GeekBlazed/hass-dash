export interface IWebSocketSubscription {
  unsubscribe(): void;
}

/**
 * Minimal WebSocket transport abstraction.
 *
 * This interface intentionally stays protocol-agnostic (it sends/receives strings).
 * Home Assistant-specific authentication/reconnect behavior is handled by the
 * concrete implementation.
 */
export interface IWebSocketService {
  connect(wsUrl: string, accessToken: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  send(data: string): void;

  subscribe(handler: (data: string) => void): IWebSocketSubscription;

  subscribeConnectionStatus(handler: (connected: boolean) => void): IWebSocketSubscription;
}
