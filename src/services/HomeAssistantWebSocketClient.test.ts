import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IWebSocketService, IWebSocketSubscription } from '../interfaces/IWebSocketService';
import { HomeAssistantWebSocketClient } from './HomeAssistantWebSocketClient';

class MockWebSocketService implements IWebSocketService {
  connected = false;

  connectCalls: Array<{ wsUrl: string; token: string }> = [];
  sent: string[] = [];

  connectError: Error | null = null;

  private readonly subscribers = new Set<(data: string) => void>();
  private readonly statusSubscribers = new Set<(connected: boolean) => void>();

  isConnected(): boolean {
    return this.connected;
  }

  async connect(wsUrl: string, accessToken: string): Promise<void> {
    this.connectCalls.push({ wsUrl, token: accessToken });

    if (this.connectError) {
      throw this.connectError;
    }

    this.setConnected(true);
  }

  disconnect(): void {
    this.setConnected(false);
  }

  send(data: string): void {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }
    this.sent.push(data);
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

  serverSend(message: unknown): void {
    const data = JSON.stringify(message);
    for (const subscriber of this.subscribers) {
      subscriber(data);
    }
  }

  serverSendRaw(data: string): void {
    for (const subscriber of this.subscribers) {
      subscriber(data);
    }
  }

  serverReconnect(): void {
    this.setConnected(true);
  }

  private setConnected(next: boolean): void {
    if (this.connected === next) return;
    this.connected = next;
    for (const subscriber of this.statusSubscribers) {
      subscriber(next);
    }
  }
}

function createConnectionConfigStub(values: {
  baseUrl?: string;
  webSocketUrl?: string;
  accessToken?: string;
}): IHomeAssistantConnectionConfig {
  const derive = (baseUrl: string): string | undefined => {
    if (baseUrl.startsWith('https://')) {
      return `${baseUrl.replace('https://', 'wss://').replace(/\/$/, '')}/api/websocket`;
    }
    if (baseUrl.startsWith('http://')) {
      return `${baseUrl.replace('http://', 'ws://').replace(/\/$/, '')}/api/websocket`;
    }
    return undefined;
  };

  return {
    getConfig: () => ({
      baseUrl: values.baseUrl,
      webSocketUrl: values.webSocketUrl,
      accessToken: values.accessToken,
    }),
    getEffectiveWebSocketUrl: () =>
      values.webSocketUrl ?? (values.baseUrl ? derive(values.baseUrl) : undefined),
    getAccessToken: () => values.accessToken,
    validate: () => ({
      isValid: Boolean(values.accessToken) && Boolean(values.webSocketUrl || values.baseUrl),
      errors: [],
      effectiveWebSocketUrl:
        values.webSocketUrl ?? (values.baseUrl ? derive(values.baseUrl) : undefined),
    }),
    getOverrides: () => ({}),
    setOverrides: () => {},
    clearOverrides: () => {},
  };
}

describe('HomeAssistantWebSocketClient', () => {
  let ws: MockWebSocketService;

  beforeEach(() => {
    ws = new MockWebSocketService();
  });

  it('connect() throws when missing websocket url and token', async () => {
    const missingUrl = createConnectionConfigStub({
      accessToken: 'token',
    });

    await expect(new HomeAssistantWebSocketClient(missingUrl, ws).connect()).rejects.toThrow(
      'Home Assistant WebSocket URL is not configured'
    );

    const missingToken = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
    });

    await expect(new HomeAssistantWebSocketClient(missingToken, ws).connect()).rejects.toThrow(
      'Home Assistant access token is not configured'
    );
  });

  it('connect() derives websocket url from HA_BASE_URL when HA_WEBSOCKET_URL is not set', async () => {
    const config = createConnectionConfigStub({
      baseUrl: 'https://example/',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await expect(client.connect()).resolves.toBeUndefined();

    expect(ws.connectCalls).toHaveLength(1);
    expect(ws.connectCalls[0]).toEqual({
      wsUrl: 'wss://example/api/websocket',
      token: 'token',
    });
  });

  it('connect() surfaces transport connect errors', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    ws.connectError = new Error('bad token');
    await expect(new HomeAssistantWebSocketClient(config, ws).connect()).rejects.toThrow(
      'bad token'
    );
  });

  it('connect() returns early when already connected', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    await expect(client.connect()).resolves.toBeUndefined();
    expect(ws.connectCalls).toHaveLength(1);
  });

  it('getStates() sends get_states and returns result', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const statesPromise = client.getStates();

    const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('get_states');

    ws.serverSend({
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
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await expect(client.getStates()).rejects.toThrow('Home Assistant client is not connected');

    await client.connect();

    const pending = client.getStates();
    client.disconnect();
    await expect(pending).rejects.toThrow('WebSocket disconnected');
  });

  it('subscribeToEvents() invokes handler for matching subscription id and can unsubscribe', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents('state_changed', handler);

    const subscribeSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };

    expect(subscribeSent.type).toBe('subscribe_events');
    expect(subscribeSent.event_type).toBe('state_changed');

    ws.serverSend({ id: subscribeSent.id, type: 'result', success: true, result: null });

    const subscription = await subscriptionPromise;

    ws.serverSend({
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

    const unsubscribeSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      subscription: number;
    };

    expect(unsubscribeSent.type).toBe('unsubscribe_events');
    expect(unsubscribeSent.subscription).toBe(subscribeSent.id);

    ws.serverSend({ id: unsubscribeSent.id, type: 'result', success: true, result: null });

    await expect(unsubscribePromise).resolves.toBeUndefined();
  });

  it('subscribeToEvents() omits event_type when null and still resolves unsubscribe if it cannot reach server', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents(null, handler);

    const subscribeSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };

    expect(subscribeSent.type).toBe('subscribe_events');
    expect(subscribeSent.event_type).toBeUndefined();

    ws.serverSend({ id: subscribeSent.id, type: 'result', success: true, result: null });
    const subscription = await subscriptionPromise;

    client.disconnect();

    await expect(subscription.unsubscribe()).resolves.toBeUndefined();
  });

  it('getServices() normalizes WS mapping into domain array', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const servicesPromise = client.getServices();

    const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('get_services');

    ws.serverSend({
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
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const promise = client.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.kitchen' },
      service_data: { brightness: 200 },
      return_response: true,
    });

    const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
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

    ws.serverSend({
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
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const promise = client.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.nope' },
    });

    const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
    };
    expect(lastSent.type).toBe('call_service');

    ws.serverSend({
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
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const statesPromise = client.getStates();

    const lastSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
    };

    ws.serverSend({
      id: lastSent.id,
      type: 'result',
      success: false,
      error: { code: 'unknown', message: 123, data: { details: 'nope' } },
    });

    await expect(statesPromise).rejects.toMatchObject({
      message: 'Home Assistant command failed',
    });

    expect(() => ws.serverSendRaw('not-json')).not.toThrow();

    // Messages that don't match a pending request or subscription should be ignored.
    expect(() =>
      ws.serverSend({ id: 999, type: 'result', success: true, result: { ok: true } })
    ).not.toThrow();
    expect(() =>
      ws.serverSend({
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

  it('resubscribes existing subscriptions after transport reconnect', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents('state_changed', handler);

    const subscribeSent = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };

    ws.serverSend({ id: subscribeSent.id, type: 'result', success: true, result: null });
    await subscriptionPromise;

    // Simulate underlying transport dropping and reconnecting.
    ws.disconnect();
    ws.serverReconnect();

    // Client should attempt to resubscribe with the same subscription id.
    const resent = ws.sent
      .map((s) => {
        try {
          return JSON.parse(s) as { type?: unknown; id?: unknown; event_type?: unknown };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((m) => m?.type === 'subscribe_events' && m?.id === subscribeSent.id);

    expect(resent.length).toBeGreaterThanOrEqual(2);
  });

  it('resubscribeAll replays subscribe_events with the same id + event_type', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const handler = vi.fn();
    const subscriptionPromise = client.subscribeToEvents('state_changed', handler);

    const initialSubscribe = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };
    expect(initialSubscribe.type).toBe('subscribe_events');
    expect(initialSubscribe.event_type).toBe('state_changed');

    ws.serverSend({ id: initialSubscribe.id, type: 'result', success: true, result: null });
    await subscriptionPromise;

    const sentBeforeReconnect = ws.sent.length;

    ws.disconnect();
    ws.serverReconnect();

    let resubscribeRaw: string | undefined;
    for (let idx = ws.sent.length - 1; idx >= sentBeforeReconnect; idx -= 1) {
      const s = ws.sent[idx];
      try {
        const parsed = JSON.parse(s) as { type?: unknown; id?: unknown };
        if (parsed.type === 'subscribe_events' && parsed.id === initialSubscribe.id) {
          resubscribeRaw = s;
          break;
        }
      } catch {
        // Ignore unparsable messages.
      }
    }

    expect(resubscribeRaw).toBeTruthy();
    const resubscribe = JSON.parse(resubscribeRaw as string) as {
      id: number;
      type: string;
      event_type?: string;
    };

    expect(resubscribe).toMatchObject({
      id: initialSubscribe.id,
      type: 'subscribe_events',
      event_type: 'state_changed',
    });

    // Unblock the internal resubscribe loop.
    ws.serverSend({ id: resubscribe.id, type: 'result', success: true, result: null });
  });

  it('resubscribeAll continues when a resubscribe fails (and handles null event_type)', async () => {
    const config = createConnectionConfigStub({
      webSocketUrl: 'ws://example/api/websocket',
      accessToken: 'token',
    });

    const client = new HomeAssistantWebSocketClient(config, ws);
    await client.connect();

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const sub1Promise = client.subscribeToEvents('state_changed', handler1);
    const sub1 = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };
    ws.serverSend({ id: sub1.id, type: 'result', success: true, result: null });
    await sub1Promise;

    const sub2Promise = client.subscribeToEvents(null, handler2);
    const sub2 = JSON.parse(ws.sent[ws.sent.length - 1]) as {
      id: number;
      type: string;
      event_type?: string;
    };
    expect(sub2.type).toBe('subscribe_events');
    expect('event_type' in sub2).toBe(false);
    ws.serverSend({ id: sub2.id, type: 'result', success: true, result: null });
    await sub2Promise;

    const sentBeforeReconnect = ws.sent.length;

    ws.disconnect();
    ws.serverReconnect();

    // With parallel resubscribe, we should see both resubscribe attempts issued after reconnect.
    const resubscribeMessages = ws.sent
      .slice(sentBeforeReconnect)
      .map((s) => {
        try {
          return JSON.parse(s) as { id?: unknown; type?: unknown; event_type?: unknown };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((m) => m?.type === 'subscribe_events') as Array<{
      id: number;
      type: 'subscribe_events';
      event_type?: string;
    }>;

    const sub1Resubscribe = resubscribeMessages.find((m) => m.id === sub1.id);
    const sub2Resubscribe = resubscribeMessages.find((m) => m.id === sub2.id);

    expect(sub1Resubscribe).toMatchObject({
      id: sub1.id,
      type: 'subscribe_events',
      event_type: 'state_changed',
    });
    expect(sub2Resubscribe).toBeTruthy();
    expect(sub2Resubscribe?.id).toBe(sub2.id);
    expect(sub2Resubscribe?.type).toBe('subscribe_events');
    expect(sub2Resubscribe && 'event_type' in sub2Resubscribe).toBe(false);

    // Simulate one resubscribe failing and the other succeeding.
    ws.serverSend({
      id: sub1.id,
      type: 'result',
      success: false,
      error: { code: 'unknown', message: 'nope', data: null },
    });
    ws.serverSend({ id: sub2.id, type: 'result', success: true, result: null });

    // Ensure the client still routes events for the successfully resubscribed id.
    ws.serverSend({
      id: sub2.id,
      type: 'event',
      event: {
        event_type: 'state_changed',
        data: { entity_id: 'light.kitchen', old_state: null, new_state: null },
        time_fired: '2026-01-01T00:00:00+00:00',
        origin: 'LOCAL',
        context: { id: '1', parent_id: null, user_id: null },
      },
    });

    expect(handler2).toHaveBeenCalled();
  });
});
