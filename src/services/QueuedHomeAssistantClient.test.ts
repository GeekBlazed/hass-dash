import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaCallServiceParams } from '../types/home-assistant';
import { idbQueueGetAll } from '../utils/indexedDb';
import { HomeAssistantServiceCallQueue } from './HomeAssistantServiceCallQueue';
import { QueuedHomeAssistantClient } from './QueuedHomeAssistantClient';

type QueuedCallRecord = {
  id: string;
  createdAtMs: number;
  attempts: number;
  params: HaCallServiceParams;
};

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
  });
}

describe('QueuedHomeAssistantClient + HomeAssistantServiceCallQueue', () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  it('queues callService when browser is offline', async () => {
    setNavigatorOnline(false);

    const rawClient = {
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    const result = await client.callService({ domain: 'light', service: 'turn_on' });

    expect(rawClient.callService).not.toHaveBeenCalled();
    expect(result.response).toEqual({ queued: true });

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
    expect(items[0]?.params?.domain).toBe('light');
  });

  it('queues callService when raw client reports disconnected', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('WebSocket is not connected')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    const result = await client.callService({ domain: 'light', service: 'turn_off' });

    expect(rawClient.callService).toHaveBeenCalledTimes(1);
    expect(result.response).toEqual({ queued: true });

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
    expect(items[0]?.params?.service).toBe('turn_off');
  });

  it('flush() replays queued calls when online', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockResolvedValue({
        context: { id: '1', parent_id: null, user_id: null },
        response: {},
      }),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);

    await queue.enqueue({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.kitchen' },
    });
    await queue.enqueue({
      domain: 'light',
      service: 'turn_off',
      target: { entity_id: 'light.kitchen' },
    });

    await queue.flush();

    expect(rawClient.callService).toHaveBeenCalledTimes(2);

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(0);
  });

  it('flush() stops early on disconnect-like errors', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('WebSocket is not connected')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);

    await queue.enqueue({ domain: 'light', service: 'turn_on' });
    await queue.enqueue({ domain: 'light', service: 'turn_off' });

    await queue.flush();

    // We tried the first, then stopped.
    expect(rawClient.callService).toHaveBeenCalledTimes(1);

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('connectWithConfig uses raw connectWithConfig when available', async () => {
    const rawClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn().mockResolvedValue(undefined),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    await client.connectWithConfig({ baseUrl: 'http://ha.local:8123' });

    expect(rawClient.connectWithConfig).toHaveBeenCalledTimes(1);
    expect(rawClient.connect).not.toHaveBeenCalled();
  });

  it('connectWithConfig falls back to connect when raw client lacks connectWithConfig', async () => {
    const rawClient = {
      connect: vi.fn().mockResolvedValue(undefined),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    await client.connectWithConfig({ baseUrl: 'http://ha.local:8123' });

    expect(rawClient.connect).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-retryable callService errors', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('permission denied')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    await expect(client.callService({ domain: 'light', service: 'turn_on' })).rejects.toThrow(
      'permission denied'
    );
  });

  it('queues callService on retryable disconnect message variants', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('Home Assistant client is not connected')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    const client = new QueuedHomeAssistantClient(rawClient, queue);

    const result = await client.callService({ domain: 'light', service: 'turn_on' });

    expect(result.response).toEqual({ queued: true });
    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
  });

  it('subscribeToTrigger rejects when unsupported and forwards when supported', async () => {
    const unsupportedRaw = {
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const unsupportedClient = new QueuedHomeAssistantClient(
      unsupportedRaw,
      new HomeAssistantServiceCallQueue(unsupportedRaw)
    );

    await expect(
      unsupportedClient.subscribeToTrigger(
        { platform: 'state', entity_id: 'light.kitchen' },
        () => undefined
      )
    ).rejects.toThrow('subscribeToTrigger is not supported by this client');

    const subscription = { unsubscribe: vi.fn().mockResolvedValue(undefined) };
    const supportedRaw = {
      subscribeToTrigger: vi.fn().mockResolvedValue(subscription),
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const supportedClient = new QueuedHomeAssistantClient(
      supportedRaw,
      new HomeAssistantServiceCallQueue(supportedRaw)
    );

    const result = await supportedClient.subscribeToTrigger(
      { platform: 'state', entity_id: 'light.kitchen' },
      () => undefined
    );

    expect(result).toBe(subscription);
    expect(supportedRaw.subscribeToTrigger).toHaveBeenCalledTimes(1);
  });

  it('sendCommand and registry helpers reject when unsupported', async () => {
    const rawClient = {
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const client = new QueuedHomeAssistantClient(
      rawClient,
      new HomeAssistantServiceCallQueue(rawClient)
    );

    await expect(client.sendCommand({ type: 'ping' })).rejects.toThrow(
      'sendCommand is not supported by this client'
    );
    await expect(client.getEntityRegistry()).rejects.toThrow(
      'getEntityRegistry is not supported by this client'
    );
    await expect(client.getDeviceRegistry()).rejects.toThrow(
      'getDeviceRegistry is not supported by this client'
    );
    await expect(client.getLabelRegistry()).rejects.toThrow(
      'getLabelRegistry is not supported by this client'
    );
    await expect(client.getAreaRegistry()).rejects.toThrow(
      'getAreaRegistry is not supported by this client'
    );
  });

  it('sendCommand and registry helpers forward when implemented', async () => {
    const rawClient = {
      callService: vi.fn(),
      sendCommand: vi.fn().mockResolvedValue({ ok: true }),
      getEntityRegistry: vi.fn().mockResolvedValue([{ id: 'entity_1' }]),
      getDeviceRegistry: vi.fn().mockResolvedValue([{ id: 'device_1' }]),
      getLabelRegistry: vi.fn().mockResolvedValue([{ id: 'label_1' }]),
      getAreaRegistry: vi.fn().mockResolvedValue([{ id: 'area_1' }]),
    } as unknown as IHomeAssistantClient;

    const client = new QueuedHomeAssistantClient(
      rawClient,
      new HomeAssistantServiceCallQueue(rawClient)
    );

    await expect(client.sendCommand({ type: 'ping' })).resolves.toEqual({ ok: true });
    await expect(client.getEntityRegistry()).resolves.toEqual([{ id: 'entity_1' }]);
    await expect(client.getDeviceRegistry()).resolves.toEqual([{ id: 'device_1' }]);
    await expect(client.getLabelRegistry()).resolves.toEqual([{ id: 'label_1' }]);
    await expect(client.getAreaRegistry()).resolves.toEqual([{ id: 'area_1' }]);
  });

  it('flush returns early when browser is offline', async () => {
    setNavigatorOnline(false);

    const rawClient = {
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });

    await queue.flush();

    expect(rawClient.callService).not.toHaveBeenCalled();
    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
  });

  it('flush increments attempts and retains item on non-offline errors', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('invalid payload')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });

    await queue.flush();

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
    expect(items[0]?.attempts).toBe(1);
  });

  it('flush stops early on failed-to-fetch errors without incrementing attempts', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });
    await queue.enqueue({ domain: 'light', service: 'turn_off' });

    await queue.flush();

    expect(rawClient.callService).toHaveBeenCalledTimes(1);
    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(2);
    expect(items[0]?.attempts ?? 0).toBe(0);
  });

  it('flush stops processing when browser goes offline mid-loop', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockImplementation(async () => {
        setNavigatorOnline(false);
        return { context: { id: '1', parent_id: null, user_id: null }, response: {} };
      }),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });
    await queue.enqueue({ domain: 'light', service: 'turn_off' });

    await queue.flush();

    expect(rawClient.callService).toHaveBeenCalledTimes(1);
    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
  });

  it('enqueue uses crypto.randomUUID when available', async () => {
    setNavigatorOnline(true);

    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('uuid-123'),
    });

    const rawClient = {
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items[0]?.id).toBe('uuid-123');

    vi.stubGlobal('crypto', originalCrypto);
  });

  it('enqueue falls back to generated id when crypto.randomUUID is unavailable', async () => {
    setNavigatorOnline(true);

    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {});

    const rawClient = {
      callService: vi.fn(),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items[0]?.id.startsWith('q-')).toBe(true);

    vi.stubGlobal('crypto', originalCrypto);
  });

  it('flush treats network-related errors as offline-like and stops early', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue(new Error('Network timeout')),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });
    await queue.enqueue({ domain: 'light', service: 'turn_off' });

    await queue.flush();

    expect(rawClient.callService).toHaveBeenCalledTimes(1);
    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(2);
  });

  it('flush increments attempts when non-Error values are thrown', async () => {
    setNavigatorOnline(true);

    const rawClient = {
      callService: vi.fn().mockRejectedValue('boom'),
    } as unknown as IHomeAssistantClient;

    const queue = new HomeAssistantServiceCallQueue(rawClient);
    await queue.enqueue({ domain: 'light', service: 'turn_on' });

    await queue.flush();

    const items = await idbQueueGetAll<QueuedCallRecord>();
    expect(items).toHaveLength(1);
    expect(items[0]?.attempts).toBe(1);
  });
});
