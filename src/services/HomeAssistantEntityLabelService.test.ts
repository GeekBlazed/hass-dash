import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { HomeAssistantEntityLabelService } from './HomeAssistantEntityLabelService';

describe('HomeAssistantEntityLabelService', () => {
  it('returns empty when label does not exist', async () => {
    const client = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      getLabelRegistry: vi.fn().mockResolvedValue([{ label_id: 'x', name: 'Other' }]),
      getDeviceRegistry: vi.fn().mockResolvedValue([]),
      getEntityRegistry: vi
        .fn()
        .mockResolvedValue([{ entity_id: 'sensor.outdoor_temperature', labels: ['x'] }]),
    } satisfies Partial<IHomeAssistantClient> as unknown as IHomeAssistantClient;

    const svc = new HomeAssistantEntityLabelService(client);
    const ids = await svc.getEntityIdsByLabelName('Weather');
    expect(ids.size).toBe(0);
  });

  it('returns entity ids matching a label name (case-insensitive)', async () => {
    const client = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      getLabelRegistry: vi.fn().mockResolvedValue([
        { label_id: 'a', name: 'Weather' },
        { label_id: 'b', name: 'Household' },
      ]),
      getDeviceRegistry: vi.fn().mockResolvedValue([]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        { entity_id: 'sensor.weather_temperature', labels: ['a'] },
        { entity_id: 'sensor.weather_humidity', labels: ['a'] },
        { entity_id: 'sensor.other', labels: ['b'] },
      ]),
    } satisfies Partial<IHomeAssistantClient> as unknown as IHomeAssistantClient;

    const svc = new HomeAssistantEntityLabelService(client);
    const ids = await svc.getEntityIdsByLabelName('wEaThEr');

    expect(ids).toEqual(new Set(['sensor.weather_temperature', 'sensor.weather_humidity']));
  });

  it('includes entity ids when the label is applied to the device (not the entity)', async () => {
    const client = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      getLabelRegistry: vi.fn().mockResolvedValue([{ label_id: 'l1', name: 'hass-dash' }]),
      getDeviceRegistry: vi.fn().mockResolvedValue([
        { id: 'device_1', labels: ['l1'] },
        { id: 'device_2', labels: [] },
      ]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        { entity_id: 'sensor.from_device_label', device_id: 'device_1' },
        { entity_id: 'sensor.not_labeled', device_id: 'device_2' },
      ]),
    } satisfies Partial<IHomeAssistantClient> as unknown as IHomeAssistantClient;

    const svc = new HomeAssistantEntityLabelService(client);
    const ids = await svc.getEntityIdsByLabelName('hass-dash');

    expect(ids).toEqual(new Set(['sensor.from_device_label']));
  });
});
