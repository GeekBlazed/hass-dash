import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IConfigService } from '../interfaces/IConfigService';
import { HomeAssistantWebSocketClient } from './HomeAssistantWebSocketClient';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  sent: string[] = [];

  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.({});
  }

  serverSend(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverSendRaw(data: string): void {
    this.onmessage?.({ data });
  }

  serverError(): void {
    this.onerror?.({});
  }

  serverClose(code = 1000, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

function createConfigStub(values: Record<string, string | undefined>): IConfigService {
  return {
    getAppVersion: () => '0.1.0',
    isFeatureEnabled: () => false,
    getConfig: (key: string) => {
      const normalized = key.startsWith('VITE_') ? key : `VITE_${key}`;
      return values[normalized];
    },
  };
}

describe('HomeAssistantWebSocketClient', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = MockWebSocket;
  });

  it('connect() throws when missing websocket url and token', async () => {
    const missingUrl = createConfigStub({
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    await expect(new HomeAssistantWebSocketClient(missingUrl).connect()).rejects.toThrow(
      'Home Assistant WebSocket URL is not configured'
    );

    const missingToken = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
    });

    await expect(new HomeAssistantWebSocketClient(missingToken).connect()).rejects.toThrow(
      'Home Assistant access token is not configured'
    );
  });

  it('connect() derives websocket url from HA_BASE_URL when HA_WEBSOCKET_URL is not set', async () => {
    const config = createConfigStub({
      VITE_HA_BASE_URL: 'https://example/',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe('wss://example/api/websocket');

    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await expect(connectPromise).resolves.toBeUndefined();
  });

  it('connect() rejects on auth_invalid and on malformed JSON during auth handshake', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client1 = new HomeAssistantWebSocketClient(config);
    const p1 = client1.connect();
    const s1 = MockWebSocket.instances[0];
    s1.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    s1.serverSend({ type: 'auth_invalid', message: 'bad token' });
    await expect(p1).rejects.toThrow('bad token');

    const client2 = new HomeAssistantWebSocketClient(config);
    const p2 = client2.connect();
    const s2 = MockWebSocket.instances[1];
    s2.serverSendRaw('not-json');
    await expect(p2).rejects.toBeDefined();
  });

  it('connect() rejects on socket error and on socket close before auth completes', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client1 = new HomeAssistantWebSocketClient(config);
    const p1 = client1.connect();
    const s1 = MockWebSocket.instances[0];
    s1.serverError();
    await expect(p1).rejects.toThrow('Failed to connect to Home Assistant WebSocket');

    const client2 = new HomeAssistantWebSocketClient(config);
    const p2 = client2.connect();
    const s2 = MockWebSocket.instances[1];
    s2.serverClose(1006, 'handshake failed');
    await expect(p2).rejects.toThrow(
      'WebSocket closed before auth completed (1006: handshake failed)'
    );
  });

  it('connect() returns early when already connected', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    await expect(client.connect()).resolves.toBeUndefined();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('connect() authenticates on auth_required and resolves on auth_ok', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe('ws://example/api/websocket');

    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });

    expect(socket.sent.length).toBe(1);
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'auth', access_token: 'token' });

    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });

    await expect(connectPromise).resolves.toBeUndefined();
    expect(client.isConnected()).toBe(true);
  });

  it('getStates() sends get_states and returns result', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const statesPromise = client.getStates();

    const lastSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('get_states');

    socket.serverSend({
      id: lastSent.id,
      type: 'result',
      success: true,
      result: [
        {
          entity_id: 'light.kitchen',
          state: 'on',
          attributes: { friendly_name: 'Kitchen' },
          last_changed: '2026-01-01T00:00:00+00:00',
          last_updated: '2026-01-01T00:00:00+00:00',
          context: { id: '1', parent_id: null, user_id: null },
        },
      ],
    });

    const states = await statesPromise;
    expect(states).toHaveLength(1);
    expect(states[0].entity_id).toBe('light.kitchen');
  });

  it('commands reject when not connected, and pending commands reject on disconnect', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    await expect(client.getStates()).rejects.toThrow('Home Assistant client is not connected');

    const connectPromise = client.connect();
    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const pending = client.getStates();
    client.disconnect();
    await expect(pending).rejects.toThrow('WebSocket disconnected');
  });

  it('subscribeToEvents() invokes handler for matching subscription id and can unsubscribe', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents('state_changed', handler);

    const subscribeSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };

    expect(subscribeSent.type).toBe('subscribe_events');
    expect(subscribeSent.event_type).toBe('state_changed');

    socket.serverSend({ id: subscribeSent.id, type: 'result', success: true, result: null });

    const subscription = await subscriptionPromise;

    socket.serverSend({
      id: subscribeSent.id,
      type: 'event',
      event: {
        event_type: 'state_changed',
        data: { entity_id: 'light.kitchen', old_state: null, new_state: null },
        time_fired: '2026-01-01T00:00:00+00:00',
        origin: 'LOCAL',
        context: { id: '1', parent_id: null, user_id: null },
      },
    });

    expect(handler).toHaveBeenCalledTimes(1);

    const unsubscribePromise = subscription.unsubscribe();

    const unsubscribeSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
      subscription: number;
    };

    expect(unsubscribeSent.type).toBe('unsubscribe_events');
    expect(unsubscribeSent.subscription).toBe(subscribeSent.id);

    socket.serverSend({ id: unsubscribeSent.id, type: 'result', success: true, result: null });

    await expect(unsubscribePromise).resolves.toBeUndefined();
  });

  it('subscribeToEvents() omits event_type when null and still resolves unsubscribe if it cannot reach server', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents(null, handler);

    const subscribeSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };

    expect(subscribeSent.type).toBe('subscribe_events');
    expect(subscribeSent.event_type).toBeUndefined();

    socket.serverSend({ id: subscribeSent.id, type: 'result', success: true, result: null });
    const subscription = await subscriptionPromise;

    client.disconnect();

    await expect(subscription.unsubscribe()).resolves.toBeUndefined();
  });

  it('getServices() normalizes WS mapping into domain array', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const servicesPromise = client.getServices();

    const lastSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('get_services');

    socket.serverSend({
      id: lastSent.id,
      type: 'result',
      success: true,
      result: {
        light: {
          services: {
            turn_on: {
              description: 'Turn on',
              fields: {},
            },
          },
        },
      },
    });

    const services = await servicesPromise;
    expect(services).toHaveLength(1);
    expect(services[0].domain).toBe('light');
    expect(services[0].services.turn_on).toBeDefined();
  });

  it('callService() sends call_service and resolves with result wrapper', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const promise = client.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.kitchen' },
      service_data: { brightness: 200 },
      return_response: true,
    });

    const lastSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
      domain: string;
      service: string;
      target?: unknown;
      service_data?: unknown;
      return_response?: boolean;
    };

    expect(lastSent.type).toBe('call_service');
    expect(lastSent.domain).toBe('light');
    expect(lastSent.service).toBe('turn_on');

    socket.serverSend({
      id: lastSent.id,
      type: 'result',
      success: true,
      result: {
        context: { id: '1', parent_id: null, user_id: null },
        response: { ok: true },
      },
    });

    await expect(promise).resolves.toMatchObject({
      response: { ok: true },
    });
  });

  it('callService() rejects with Error for HA error envelope', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const promise = client.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.nope' },
    });

    const lastSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('call_service');

    socket.serverSend({
      id: lastSent.id,
      type: 'result',
      success: false,
      error: { code: 'service_not_found', message: 'Service not found' },
    });

    await expect(promise).rejects.toMatchObject({
      message: 'Service not found',
      code: 'service_not_found',
    });
  });

  it('sendCommand() rejects with default error when HA error has no string message, and ignores invalid JSON post-connect', async () => {
    const config = createConfigStub({
      VITE_HA_WEBSOCKET_URL: 'ws://example/api/websocket',
      VITE_HA_ACCESS_TOKEN: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config);
    const connectPromise = client.connect();

    const socket = MockWebSocket.instances[0];
    socket.serverSend({ type: 'auth_required', ha_version: '2026.1.0' });
    socket.serverSend({ type: 'auth_ok', ha_version: '2026.1.0' });
    await connectPromise;

    const statesPromise = client.getStates();

    const lastSent = JSON.parse(socket.sent[socket.sent.length - 1]) as {
      id: number;
      type: string;
    };

    socket.serverSend({
      id: lastSent.id,
      type: 'result',
      success: false,
      error: { code: 'unknown', message: 123, data: { details: 'nope' } },
    });

    await expect(statesPromise).rejects.toMatchObject({
      message: 'Home Assistant command failed',
    });

    expect(() => socket.serverSendRaw('not-json')).not.toThrow();

    // Messages that don't match a pending request or subscription should be ignored.
    expect(() =>
      socket.serverSend({ id: 999, type: 'result', success: true, result: { ok: true } })
    ).not.toThrow();
    expect(() =>
      socket.serverSend({
        id: 999,
        type: 'event',
        event: {
          event_type: 'state_changed',
          data: { entity_id: 'light.kitchen', old_state: null, new_state: null },
          time_fired: '2026-01-01T00:00:00+00:00',
          origin: 'LOCAL',
          context: { id: '1', parent_id: null, user_id: null },
        },
      })
    ).not.toThrow();
  });
});
