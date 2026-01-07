import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHttpClient } from '../interfaces/IHttpClient';
import { HomeAssistantEntityService } from './HomeAssistantEntityService';

describe('HomeAssistantEntityService', () => {
  it('fetchStates() calls REST /api/states', async () => {
    const http: IHttpClient = {
      get: vi.fn().mockResolvedValue([{ entity_id: 'light.kitchen' }]),
      post: vi.fn(),
    };

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);
    const result = await service.fetchStates();

    expect(http.get).toHaveBeenCalledWith('/api/states');
    expect(result).toHaveLength(1);
  });

  it('subscribeToStateChanges() connects and forwards new_state', async () => {
    const http: IHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'light.kitchen',
            old_state: null,
            new_state: {
              entity_id: 'light.kitchen',
              state: 'on',
              attributes: {},
              last_changed: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              context: { id: '1', parent_id: null, user_id: null },
            },
          },
          time_fired: new Date().toISOString(),
          origin: 'LOCAL',
          context: { id: '2', parent_id: null, user_id: null },
        });

        return { unsubscribe };
      }),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);

    const handler = vi.fn();
    const sub = await service.subscribeToStateChanges(handler);

    expect(ha.connect).toHaveBeenCalledTimes(1);
    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'light.kitchen' }));

    await expect(sub.unsubscribe()).resolves.toBeUndefined();
  });
});
