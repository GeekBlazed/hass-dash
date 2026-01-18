import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaEntityId } from '../types/home-assistant';
import { HomeAssistantLightService } from './HomeAssistantLightService';

describe('HomeAssistantLightService', () => {
  it('calls light.turn_off for a single entity id', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: IHomeAssistantClient = {
      connect,
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn().mockResolvedValue([]),
      getState: vi.fn().mockResolvedValue(null),
      getServices: vi.fn().mockResolvedValue([]),
      subscribeToEvents: vi.fn(),
      callService,
    };

    const service = new HomeAssistantLightService(mockClient);

    await service.turnOff('light.kitchen_ceiling' as HaEntityId);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_off',
      service_data: { entity_id: ['light.kitchen_ceiling'] },
      target: { entity_id: ['light.kitchen_ceiling'] },
    });
  });

  it('calls light.turn_on for multiple entity ids', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: IHomeAssistantClient = {
      connect,
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      getStates: vi.fn().mockResolvedValue([]),
      getState: vi.fn().mockResolvedValue(null),
      getServices: vi.fn().mockResolvedValue([]),
      subscribeToEvents: vi.fn(),
      callService,
    };

    const service = new HomeAssistantLightService(mockClient);

    await service.turnOn(['light.a', 'light.b'] as HaEntityId[]);

    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_on',
      service_data: { entity_id: ['light.a', 'light.b'] },
      target: { entity_id: ['light.a', 'light.b'] },
    });
  });
});
