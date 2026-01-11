import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHttpClient } from '../interfaces/IHttpClient';
import { HomeAssistantEntityService } from './HomeAssistantEntityService';

describe('HomeAssistantEntityService', () => {
  it('fetchStates() prefers WebSocket get_states', async () => {
    const http: IHttpClient = {
      get: vi.fn().mockResolvedValue([{ entity_id: 'light.kitchen' }]),
      post: vi.fn(),
    };

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn().mockResolvedValue([{ entity_id: 'light.kitchen' }]),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);
    const result = await service.fetchStates();

    expect(ha.connect).toHaveBeenCalledTimes(1);
    expect(ha.getStates).toHaveBeenCalledTimes(1);
    expect(http.get).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('fetchStates() falls back to REST when WebSocket get_states fails', async () => {
    const http: IHttpClient = {
      get: vi.fn().mockResolvedValue([{ entity_id: 'light.kitchen' }]),
      post: vi.fn(),
    };

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn().mockRejectedValue(new Error('ws down')),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);
    const result = await service.fetchStates();

    expect(ha.connect).toHaveBeenCalledTimes(1);
    expect(ha.getStates).toHaveBeenCalledTimes(1);
    expect(http.get).toHaveBeenCalledWith('/api/states');
    expect(result).toHaveLength(1);
  });

  it('fetchStates() surfaces both WebSocket and REST failures', async () => {
    const http: IHttpClient = {
      get: vi.fn().mockRejectedValue(new Error('rest down')),
      post: vi.fn(),
    };

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockRejectedValue(new Error('ws connect failed')),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);
    await expect(service.fetchStates()).rejects.toThrow(/WebSocket/i);
    await expect(service.fetchStates()).rejects.toThrow(/REST/i);
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

  it('subscribeToStateChanges() does not connect when already connected', async () => {
    const http: IHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockResolvedValue({ unsubscribe }),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(http, ha);
    const handler = vi.fn();
    await service.subscribeToStateChanges(handler);

    expect(ha.connect).not.toHaveBeenCalled();
    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
  });

  it('subscribeToStateChanges() ignores events without new_state', async () => {
    const http: IHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'light.kitchen',
            old_state: null,
            new_state: null,
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
    await service.subscribeToStateChanges(handler);

    expect(handler).not.toHaveBeenCalled();
  });
});
