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
});
