import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { HomeAssistantHouseholdAreaEntityIndexService } from './HomeAssistantHouseholdAreaEntityIndexService';

describe('HomeAssistantHouseholdAreaEntityIndexService', () => {
  it('returns areas but empty sets when Household label is not present', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(false);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry: vi.fn().mockResolvedValue([{ label_id: 'x', name: 'Other' }]),
      getAreaRegistry: vi.fn().mockResolvedValue([{ area_id: 'area_kitchen', name: 'Kitchen' }]),
      getDeviceRegistry: vi.fn().mockResolvedValue([]),
      getEntityRegistry: vi.fn().mockResolvedValue([]),
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    const areas = await service.getAllAreas();
    expect(areas).toEqual([{ areaId: 'area_kitchen', name: 'Kitchen' }]);

    const devices = await service.getHouseholdDeviceIdsByAreaId('area_kitchen');
    expect(Array.from(devices)).toEqual([]);

    const temps = await service.getHouseholdEntityIdsByAreaId('area_kitchen', 'temperature');
    expect(Array.from(temps)).toEqual([]);

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('indexes household devices and entities by effective area and kind', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry: vi.fn().mockResolvedValue([
        { label_id: 'label_household', name: 'Household' },
        { label_id: 'label_other', name: 'Other' },
      ]),
      getAreaRegistry: vi.fn().mockResolvedValue([
        { area_id: 'area_a', name: 'Area A' },
        { area_id: 'area_b', name: 'Area B' },
      ]),
      getDeviceRegistry: vi.fn().mockResolvedValue([
        { id: 'device1', area_id: 'area_a', labels: ['label_household'] },
        { id: 'device2', area_id: 'area_b', labels: ['label_other'] },
      ]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        // Inherits area from household device
        { entity_id: 'sensor.kitchen_temperature', device_id: 'device1' },
        // Household label directly, explicit area
        { entity_id: 'sensor.kitchen_humidity', area_id: 'area_b', labels: ['label_household'] },
        // Light domain (strict)
        { entity_id: 'light.lamp', area_id: 'area_a', labels: ['label_household'] },
        // Climate domain allowed for temp keyword
        {
          entity_id: 'climate.living_room_temperature',
          area_id: 'area_a',
          labels: ['label_household'],
        },
        // Household but irrelevant kind (should be excluded)
        { entity_id: 'sensor.kitchen_power', area_id: 'area_a', labels: ['label_household'] },
        // Household but missing effective area (ignored)
        { entity_id: 'sensor.nowhere_temperature', labels: ['label_household'] },
      ]),
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    const areas = await service.getAllAreas();
    expect(areas.map((a) => a.areaId).sort()).toEqual(['area_a', 'area_b']);

    const areaADevices = await service.getHouseholdDeviceIdsByAreaId('area_a');
    expect(Array.from(areaADevices)).toEqual(['device1']);

    const areaATemps = await service.getHouseholdEntityIdsByAreaId('area_a', 'temperature');
    expect(Array.from(areaATemps).sort()).toEqual([
      'climate.living_room_temperature',
      'sensor.kitchen_temperature',
    ]);

    const areaALights = await service.getHouseholdEntityIdsByAreaId('area_a', 'light');
    expect(Array.from(areaALights)).toEqual(['light.lamp']);

    const areaBHumidity = await service.getHouseholdEntityIdsByAreaId('area_b', 'humidity');
    expect(Array.from(areaBHumidity)).toEqual(['sensor.kitchen_humidity']);

    expect(connect).not.toHaveBeenCalled();
  });
});
