import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { HomeAssistantEntityService } from './HomeAssistantEntityService';

describe('HomeAssistantEntityService', () => {
  it('fetchStates() prefers WebSocket get_states', async () => {
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

    const service = new HomeAssistantEntityService(ha);
    const result = await service.fetchStates();

    expect(ha.connect).toHaveBeenCalledTimes(1);
    expect(ha.getStates).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('fetchStates() throws when WebSocket get_states fails', async () => {
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

    const service = new HomeAssistantEntityService(ha);
    await expect(service.fetchStates()).rejects.toThrow(/ws down/i);
    await expect(service.fetchStates()).rejects.toThrow(/WebSocket/i);
  });

  it('fetchStates() throws when WebSocket returns an empty response', async () => {
    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);
    await expect(service.fetchStates()).rejects.toThrow(/empty response/i);
    await expect(service.fetchStates()).rejects.toThrow(/WebSocket/i);
  });

  it('fetchStates() stringifies non-Error failures when WebSocket connect fails', async () => {
    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockRejectedValue('ws connect failed'),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);
    await expect(service.fetchStates()).rejects.toThrow(/ws connect failed/i);
    await expect(service.fetchStates()).rejects.toThrow(/WebSocket/i);
  });

  it('subscribeToStateChanges() connects and forwards new_state', async () => {
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

    const service = new HomeAssistantEntityService(ha);

    const handler = vi.fn();
    const sub = await service.subscribeToStateChanges(handler);

    expect(ha.connect).toHaveBeenCalledTimes(1);
    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'light.kitchen' }));

    await expect(sub.unsubscribe()).resolves.toBeUndefined();
  });

  it('subscribeToStateChanges() does not connect when already connected', async () => {
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

    const service = new HomeAssistantEntityService(ha);
    const handler = vi.fn();
    await service.subscribeToStateChanges(handler);

    expect(ha.connect).not.toHaveBeenCalled();
    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
  });

  it('subscribeToStateChangesFiltered() uses subscribe_trigger when available', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn(),
      subscribeToTrigger: vi.fn().mockImplementation(async (_trigger, handler) => {
        handler({
          variables: {
            trigger: {
              platform: 'state',
              entity_id: 'sensor.keep_me',
              from_state: null,
              to_state: {
                entity_id: 'sensor.keep_me',
                state: '123',
                attributes: {},
                last_changed: new Date().toISOString(),
                last_updated: new Date().toISOString(),
                context: { id: '1', parent_id: null, user_id: null },
              },
              for: null,
              attribute: null,
            },
          },
          context: { id: '2', parent_id: null, user_id: null },
        });

        return { unsubscribe };
      }),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);

    const handler = vi.fn();
    await service.subscribeToStateChangesFiltered(['sensor.keep_me'], handler);

    expect(ha.subscribeToTrigger).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'sensor.keep_me' }));
  });

  it('subscribeToStateChangesFiltered() falls back to state_changed when subscribe_trigger is unavailable', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.ignore_me',
            old_state: null,
            new_state: {
              entity_id: 'sensor.ignore_me',
              state: 'x',
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

        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.keep_me',
            old_state: null,
            new_state: {
              entity_id: 'sensor.keep_me',
              state: 'y',
              attributes: {},
              last_changed: new Date().toISOString(),
              last_updated: new Date().toISOString(),
              context: { id: '1', parent_id: null, user_id: null },
            },
          },
          time_fired: new Date().toISOString(),
          origin: 'LOCAL',
          context: { id: '3', parent_id: null, user_id: null },
        });

        return { unsubscribe };
      }),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);

    const handler = vi.fn();
    await service.subscribeToStateChangesFiltered(['sensor.keep_me'], handler);

    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'sensor.keep_me' }));
  });

  it('subscribeToStateChangesFiltered() falls back to state_changed when subscribe_trigger is unauthorized', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(undefined);

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        handler({
          event_type: 'state_changed',
          data: {
            entity_id: 'sensor.keep_me',
            old_state: null,
            new_state: {
              entity_id: 'sensor.keep_me',
              state: 'y',
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
      subscribeToTrigger: vi.fn().mockRejectedValue(
        Object.assign(new Error('Unauthorized'), {
          code: 'unauthorized',
        })
      ),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);
    const handler = vi.fn();

    await service.subscribeToStateChangesFiltered(['sensor.keep_me'], handler);

    expect(ha.subscribeToTrigger).toHaveBeenCalledTimes(1);
    expect(ha.subscribeToEvents).toHaveBeenCalledWith('state_changed', expect.any(Function));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 'sensor.keep_me' }));
  });

  it('subscribeToStateChanges() ignores events without new_state', async () => {
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

    const service = new HomeAssistantEntityService(ha);

    const handler = vi.fn();
    await service.subscribeToStateChanges(handler);

    expect(handler).not.toHaveBeenCalled();
  });

  it('subscribeToStateChanges() multiplexes handlers onto a single HA subscription', async () => {
    const haUnsubscribe = vi.fn().mockResolvedValue(undefined);
    let haHandler: ((event: unknown) => void) | null = null;

    const ha: IHomeAssistantClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      connectWithConfig: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn(),
      getState: vi.fn(),
      getServices: vi.fn(),
      subscribeToEvents: vi.fn().mockImplementation(async (_eventType, handler) => {
        haHandler = handler as unknown as (event: unknown) => void;
        return { unsubscribe: haUnsubscribe };
      }),
      callService: vi.fn(),
    };

    const service = new HomeAssistantEntityService(ha);

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const sub1 = await service.subscribeToStateChanges(handler1);
    const sub2 = await service.subscribeToStateChanges(handler2);

    expect(ha.subscribeToEvents).toHaveBeenCalledTimes(1);
    if (!haHandler) {
      throw new Error('Expected HA subscription handler to be set');
    }

    const invokeHaHandler: (event: unknown) => void = haHandler;

    invokeHaHandler({
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

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    await sub1.unsubscribe();
    expect(haUnsubscribe).not.toHaveBeenCalled();

    await sub2.unsubscribe();
    expect(haUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
