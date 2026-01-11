import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeAssistantWebSocketService } from './HomeAssistantWebSocketService';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  sent: string[] = [];
  url: string;
  readyState?: number;

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

  serverSendRaw(data: string): void {
    this.onmessage?.({ data });
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

  it('send() throws when not connected', () => {
    const service = new HomeAssistantWebSocketService();
    expect(() => service.send('hi')).toThrow('WebSocket is not connected');
  });

  it('connectOnce() rejects if wsUrl or token are not set', async () => {
    const service = new HomeAssistantWebSocketService();

    await expect(
      (service as unknown as { connectOnce: () => Promise<void> }).connectOnce()
    ).rejects.toThrow('WebSocket URL not set');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).wsUrl = 'ws://example/api/websocket';
    await expect(
      (service as unknown as { connectOnce: () => Promise<void> }).connectOnce()
    ).rejects.toThrow('Access token not set');
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

  it('connect() is a no-op when already connected', async () => {
    const service = new HomeAssistantWebSocketService();

    const first = service.connect('ws://example/api/websocket', 'token');
    const socket1 = MockWebSocket.instances[0];
    socket1.serverSend({ type: 'auth_required' });
    socket1.serverSend({ type: 'auth_ok' });
    await expect(first).resolves.toBeUndefined();
    expect(MockWebSocket.instances).toHaveLength(1);

    await expect(service.connect('ws://example/api/websocket', 'token')).resolves.toBeUndefined();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('connect() reuses the in-flight connection when connecting', async () => {
    const service = new HomeAssistantWebSocketService();

    const p1 = service.connect('ws://example/api/websocket', 'token');
    const p2 = service.connect('ws://example/api/websocket', 'token');

    // Only one socket should be created while the handshake is in progress.
    expect(MockWebSocket.instances).toHaveLength(1);

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required' });
    socket.serverSend({ type: 'auth_ok' });

    await expect(Promise.all([p1, p2])).resolves.toEqual([undefined, undefined]);
    expect(service.isConnected()).toBe(true);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('connect() rejects on auth_invalid', async () => {
    const service = new HomeAssistantWebSocketService();

    const status = vi.fn();
    service.subscribeConnectionStatus(status);

    const promise = service.connect('ws://example/api/websocket', 'token');

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required' });
    socket.serverSend({ type: 'auth_invalid', message: 'Invalid token' });

    await expect(promise).rejects.toThrow('Invalid token');
    expect(service.isConnected()).toBe(false);
    expect(status).not.toHaveBeenCalledWith(true);
  });

  it('connect() rejects if the socket closes before auth completes', async () => {
    const service = new HomeAssistantWebSocketService();

    const promise = service.connect('ws://example/api/websocket', 'token');
    const socket = MockWebSocket.instances[0];

    socket.serverClose(1006, 'dropped');

    await expect(promise).rejects.toThrow('WebSocket closed before auth completed');
    expect(service.isConnected()).toBe(false);
  });

  it('connect() rejects on socket error before auth', async () => {
    const service = new HomeAssistantWebSocketService();

    const promise = service.connect('ws://example/api/websocket', 'token');
    const socket = MockWebSocket.instances[0];

    socket.onerror?.({});

    await expect(promise).rejects.toThrow('Failed to connect to Home Assistant WebSocket');
    expect(service.isConnected()).toBe(false);
  });

  it('connect() rejects on invalid JSON during auth handshake', async () => {
    const service = new HomeAssistantWebSocketService();

    const promise = service.connect('ws://example/api/websocket', 'token');
    const socket = MockWebSocket.instances[0];

    socket.serverSendRaw('not-json');

    await expect(promise).rejects.toBeDefined();
    expect(service.isConnected()).toBe(false);
  });

  it('disconnect() clears pending reconnect and closes socket', async () => {
    const service = new HomeAssistantWebSocketService();

    const status = vi.fn();
    service.subscribeConnectionStatus(status);

    const connectPromise = service.connect('ws://example/api/websocket', 'token');
    const socket1 = MockWebSocket.instances[0];
    socket1.serverSend({ type: 'auth_required' });
    socket1.serverSend({ type: 'auth_ok' });
    await expect(connectPromise).resolves.toBeUndefined();

    // trigger reconnect scheduling
    socket1.serverClose(1006, 'dropped');
    expect(service.isConnected()).toBe(false);

    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    service.disconnect();

    // no reconnect should happen after disconnect
    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);

    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Calling disconnect again should not emit extra status events.
    const callsAfterFirstDisconnect = status.mock.calls.length;
    service.disconnect();
    expect(status.mock.calls.length).toBe(callsAfterFirstDisconnect);
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

  it('reconnects after a normal close (1000) when shouldReconnect is true', async () => {
    const service = new HomeAssistantWebSocketService();

    const connectPromise = service.connect('ws://example/api/websocket', 'token');
    const socket1 = MockWebSocket.instances[0];
    socket1.serverSend({ type: 'auth_required' });
    socket1.serverSend({ type: 'auth_ok' });
    await expect(connectPromise).resolves.toBeUndefined();

    socket1.serverClose(1000, '');

    await vi.advanceTimersByTimeAsync(500);
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('broadcasts messages to subscribers after authentication', async () => {
    const service = new HomeAssistantWebSocketService();

    const onData = vi.fn();
    service.subscribe(onData);

    const connectPromise = service.connect('ws://example/api/websocket', 'token');
    const socket1 = MockWebSocket.instances[0];
    socket1.serverSend({ type: 'auth_required' });
    socket1.serverSend({ type: 'auth_ok' });
    await expect(connectPromise).resolves.toBeUndefined();

    socket1.serverSendRaw('{"type":"event","data":123}');
    expect(onData).toHaveBeenCalledWith('{"type":"event","data":123}');
  });

  it('send() queues while socket is CONNECTING, then flushes when OPEN', async () => {
    const service = new HomeAssistantWebSocketService();

    const connectPromise = service.connect('ws://example/api/websocket', 'token');
    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required' });
    socket.serverSend({ type: 'auth_ok' });
    await expect(connectPromise).resolves.toBeUndefined();
    expect(service.isConnected()).toBe(true);

    // Force a transient CONNECTING state to exercise the send queue branch.
    socket.readyState = MockWebSocket.CONNECTING;
    service.send('hello');
    expect(socket.sent).not.toContain('hello');

    socket.readyState = MockWebSocket.OPEN;
    await vi.advanceTimersByTimeAsync(60);
    expect(socket.sent).toContain('hello');
  });
});
