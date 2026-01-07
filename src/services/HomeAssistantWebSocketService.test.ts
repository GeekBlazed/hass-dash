import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeAssistantWebSocketService } from './HomeAssistantWebSocketService';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.({ code: 1000, reason: '' });
  }

  serverSend(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose(code = 1000, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

describe('HomeAssistantWebSocketService', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('connect() authenticates and reports connected status', async () => {
    const service = new HomeAssistantWebSocketService();

    const status = vi.fn();
    service.subscribeConnectionStatus(status);

    const promise = service.connect('ws://example/api/websocket', 'token');

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe('ws://example/api/websocket');

    socket.serverSend({ type: 'auth_required' });

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'auth', access_token: 'token' });

    socket.serverSend({ type: 'auth_ok' });

    await expect(promise).resolves.toBeUndefined();
    expect(service.isConnected()).toBe(true);
    expect(status).toHaveBeenCalledWith(true);
  });

  it('reconnects after authenticated close (exponential backoff scheduling)', async () => {
    const service = new HomeAssistantWebSocketService();

    const status = vi.fn();
    service.subscribeConnectionStatus(status);

    const connectPromise = service.connect('ws://example/api/websocket', 'token');

    // complete auth on first socket
    const socket1 = MockWebSocket.instances[0];
    socket1.serverSend({ type: 'auth_required' });
    socket1.serverSend({ type: 'auth_ok' });
    await expect(connectPromise).resolves.toBeUndefined();
    expect(service.isConnected()).toBe(true);

    // close after auth -> should schedule reconnect
    socket1.serverClose(1006, 'dropped');

    // first reconnect delay is 500ms
    await vi.advanceTimersByTimeAsync(500);

    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);

    const socket2 = MockWebSocket.instances[1];
    socket2.serverSend({ type: 'auth_required' });
    socket2.serverSend({ type: 'auth_ok' });

    // allow promise callbacks to run
    await Promise.resolve();
    expect(service.isConnected()).toBe(true);

    // connection status should have toggled false -> true (in addition to initial true)
    expect(status).toHaveBeenCalledWith(true);
  });
});
