import { injectable } from 'inversify';

import type { IWebSocketService, IWebSocketSubscription } from '../interfaces/IWebSocketService';

type Subscriber = (data: string) => void;
type StatusSubscriber = (connected: boolean) => void;

@injectable()
export class HomeAssistantWebSocketService implements IWebSocketService {
  private socket: WebSocket | null = null;
  private connected = false;

  private wsUrl: string | null = null;
  private token: string | null = null;

  private shouldReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimerId: number | null = null;

  private readonly subscribers = new Set<Subscriber>();
  private readonly statusSubscribers = new Set<StatusSubscriber>();

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(handler: (data: string) => void): IWebSocketSubscription {
    this.subscribers.add(handler);
    return {
      unsubscribe: () => {
        this.subscribers.delete(handler);
      },
    };
  }

  subscribeConnectionStatus(handler: (connected: boolean) => void): IWebSocketSubscription {
    this.statusSubscribers.add(handler);
    return {
      unsubscribe: () => {
        this.statusSubscribers.delete(handler);
      },
    };
  }

  send(data: string): void {
    const socket = this.socket;
    if (!socket || !this.connected) {
      throw new Error('WebSocket is not connected');
    }
    socket.send(data);
  }

  async connect(wsUrl: string, accessToken: string): Promise<void> {
    if (this.connected) return;

    this.wsUrl = wsUrl;
    this.token = accessToken;

    this.shouldReconnect = true;
    this.clearReconnectTimer();

    await this.connectOnce();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    this.setConnected(false);

    if (this.socket) {
      try {
        this.socket.close();
      } finally {
        this.socket = null;
      }
    }
  }

  private async connectOnce(): Promise<void> {
    const wsUrl = this.wsUrl;
    const token = this.token;

    if (!wsUrl) throw new Error('WebSocket URL not set');
    if (!token) throw new Error('Access token not set');

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let authenticated = false;

      const socket = new WebSocket(wsUrl);
      this.socket = socket;

      const cleanup = () => {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
      };

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const succeed = () => {
        if (settled) return;
        settled = true;
        authenticated = true;
        cleanup();
        this.reconnectAttempt = 0;
        this.attachHandlers(socket);
        this.setConnected(true);
        resolve();
      };

      socket.onerror = () => {
        fail(
          new Error(
            `Failed to connect to Home Assistant WebSocket (${wsUrl}). ` +
              'Check that the URL resolves, the port is reachable, and your HA/proxy supports WebSocket upgrade.'
          )
        );
      };

      socket.onclose = (event) => {
        this.socket = null;
        this.setConnected(false);

        if (!settled) {
          const reason = (event as { reason?: unknown }).reason;
          const code = (event as { code?: unknown }).code;
          const reasonText = typeof reason === 'string' && reason ? `: ${reason}` : '';
          const codeNum = typeof code === 'number' ? code : 0;
          fail(new Error(`WebSocket closed before auth completed (${codeNum}${reasonText})`));
          return;
        }

        const code = (event as { code?: unknown }).code;
        const codeNum = typeof code === 'number' ? code : 0;
        const isExpectedClose = codeNum === 1000;

        // If we were authenticated and lost the socket unexpectedly, try to reconnect.
        if (authenticated && this.shouldReconnect && !isExpectedClose) {
          this.scheduleReconnect();
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = String((event as { data: unknown }).data);
          const message = JSON.parse(data) as unknown;

          if (this.isAuthRequired(message)) {
            socket.send(
              JSON.stringify({
                type: 'auth',
                access_token: token,
              })
            );
            return;
          }

          if (this.isAuthOk(message)) {
            succeed();
            return;
          }

          if (this.isAuthInvalid(message)) {
            fail(new Error(message.message));
          }
        } catch (error) {
          fail(error);
        }
      };

      socket.onopen = () => {
        // Auth initiated by server via auth_required.
      };
    });
  }

  private attachHandlers(socket: WebSocket): void {
    socket.onmessage = (event) => {
      const data = String((event as { data: unknown }).data);
      for (const subscriber of this.subscribers) {
        subscriber(data);
      }
    };

    socket.onclose = () => {
      this.socket = null;
      this.setConnected(false);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // socket will eventually close; reconnect is handled in onclose
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimerId !== null) return;

    const baseDelayMs = 500;
    const maxDelayMs = 15_000;
    const exponent = Math.min(this.reconnectAttempt, 10);

    const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, exponent));
    this.reconnectAttempt += 1;

    // In browsers: window.setTimeout returns number.
    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      void this.connectOnce().catch(() => {
        // If reconnect fails, schedule another attempt.
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimerId === null) return;
    window.clearTimeout(this.reconnectTimerId);
    this.reconnectTimerId = null;
  }

  private setConnected(next: boolean): void {
    if (this.connected === next) return;
    this.connected = next;
    for (const subscriber of this.statusSubscribers) {
      subscriber(next);
    }
  }

  private isAuthRequired(message: unknown): message is { type: 'auth_required' } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'auth_required'
    );
  }

  private isAuthOk(message: unknown): message is { type: 'auth_ok' } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'auth_ok'
    );
  }

  private isAuthInvalid(message: unknown): message is { type: 'auth_invalid'; message: string } {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'auth_invalid' &&
      typeof (message as { message?: unknown }).message === 'string'
    );
  }
}
