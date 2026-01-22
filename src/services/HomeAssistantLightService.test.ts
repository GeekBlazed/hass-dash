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

  it('calls light.turn_on with brightness for a single entity id', async () => {
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

    await service.setBrightness('light.kitchen_ceiling' as HaEntityId, 200);

    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_on',
      service_data: { entity_id: ['light.kitchen_ceiling'], brightness: 200 },
      target: { entity_id: ['light.kitchen_ceiling'] },
    });
  });

  it('calls light.turn_on with color_temp for a single entity id', async () => {
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

    await service.setColorTemperature('light.kitchen_ceiling' as HaEntityId, 250);

    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_on',
      service_data: { entity_id: ['light.kitchen_ceiling'], color_temp: 250 },
      target: { entity_id: ['light.kitchen_ceiling'] },
    });
  });

  it('calls light.turn_on with rgb_color for a single entity id', async () => {
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

    await service.setRgbColor('light.kitchen_ceiling' as HaEntityId, [1, 2, 3]);

    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_on',
      service_data: { entity_id: ['light.kitchen_ceiling'], rgb_color: [1, 2, 3] },
      target: { entity_id: ['light.kitchen_ceiling'] },
    });
  });
});
