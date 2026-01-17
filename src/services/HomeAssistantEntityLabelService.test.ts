import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { HomeAssistantEntityLabelService } from './HomeAssistantEntityLabelService';

describe('HomeAssistantEntityLabelService', () => {
  it('returns empty when label does not exist', async () => {
    const client = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      getLabelRegistry: vi.fn().mockResolvedValue([{ label_id: 'x', name: 'Other' }]),
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
});
