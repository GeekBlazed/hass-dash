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

  it('uses cached snapshot within TTL', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const getLabelRegistry = vi
      .fn()
      .mockResolvedValue([{ label_id: 'label_household', name: 'Household' }]);
    const getAreaRegistry = vi.fn().mockResolvedValue([{ area_id: 'area_a', name: 'Area A' }]);
    const getDeviceRegistry = vi
      .fn()
      .mockResolvedValue([{ id: 'device1', area_id: 'area_a', labels: ['label_household'] }]);
    const getEntityRegistry = vi
      .fn()
      .mockResolvedValue([
        { entity_id: 'sensor.area_a_humidity', area_id: 'area_a', labels: ['label_household'] },
      ]);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry,
      getAreaRegistry,
      getDeviceRegistry,
      getEntityRegistry,
    };

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000_000); // first call

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    await expect(service.getAllAreas()).resolves.toEqual([{ areaId: 'area_a', name: 'Area A' }]);

    // Second call is within TTL; should not re-fetch registries.
    nowSpy.mockReturnValueOnce(1_000_000 + 1_000);
    const humidity = await service.getHouseholdEntityIdsByAreaId('area_a', 'humidity');
    expect(Array.from(humidity)).toEqual(['sensor.area_a_humidity']);

    expect(getLabelRegistry).toHaveBeenCalledTimes(1);
    expect(getAreaRegistry).toHaveBeenCalledTimes(1);
    expect(getDeviceRegistry).toHaveBeenCalledTimes(1);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent callers via inFlight snapshot', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    let resolveLabel!: (v: unknown[]) => void;
    let resolveAreas!: (v: unknown[]) => void;
    let resolveDevices!: (v: unknown[]) => void;
    let resolveEntities!: (v: unknown[]) => void;

    const getLabelRegistry = vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveLabel = resolve;
        })
    );
    const getAreaRegistry = vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveAreas = resolve;
        })
    );
    const getDeviceRegistry = vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveDevices = resolve;
        })
    );
    const getEntityRegistry = vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolveEntities = resolve;
        })
    );

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry,
      getAreaRegistry,
      getDeviceRegistry,
      getEntityRegistry,
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    const p1 = service.getAllAreas();
    const p2 = service.getHouseholdEntityIdsByAreaId('area_a', 'temperature');

    // Both calls should share the same in-flight fetch.
    expect(getLabelRegistry).toHaveBeenCalledTimes(1);
    expect(getAreaRegistry).toHaveBeenCalledTimes(1);
    expect(getDeviceRegistry).toHaveBeenCalledTimes(1);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);

    resolveLabel([{ label_id: 'label_household', name: 'Household' }]);
    resolveAreas([{ area_id: 'area_a', name: 'Area A' }]);
    resolveDevices([{ id: 'device1', area_id: 'area_a', labels: ['label_household'] }]);
    resolveEntities([
      { entity_id: 'sensor.area_a_temperature', area_id: 'area_a', labels: ['label_household'] },
    ]);

    await expect(p1).resolves.toEqual([{ areaId: 'area_a', name: 'Area A' }]);
    await expect(p2).resolves.toEqual(new Set(['sensor.area_a_temperature']));
  });

  it('refresh overwrites cached snapshot', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const getLabelRegistry = vi
      .fn()
      .mockResolvedValue([{ label_id: 'label_household', name: 'Household' }]);
    const getAreaRegistry = vi.fn().mockResolvedValue([{ area_id: 'area_a', name: 'Area A' }]);
    const getDeviceRegistry = vi.fn().mockResolvedValue([]);
    const getEntityRegistry = vi.fn().mockResolvedValue([]);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry,
      getAreaRegistry,
      getDeviceRegistry,
      getEntityRegistry,
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    await expect(service.getAllAreas()).resolves.toEqual([{ areaId: 'area_a', name: 'Area A' }]);

    // Change underlying registries and force refresh to re-fetch.
    getAreaRegistry.mockResolvedValueOnce([{ area_id: 'area_b', name: 'Area B' }]);
    await service.refresh();

    await expect(service.getAllAreas()).resolves.toEqual([{ areaId: 'area_b', name: 'Area B' }]);
  });

  it('treats missing registry methods as empty arrays', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      // intentionally omit getLabelRegistry/getAreaRegistry/getDeviceRegistry/getEntityRegistry
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    await expect(service.getAllAreas()).resolves.toEqual([]);
    await expect(service.getHouseholdDeviceIdsByAreaId('area_x')).resolves.toEqual(new Set());
    await expect(service.getHouseholdEntityIdsByAreaId('area_x', 'temperature')).resolves.toEqual(
      new Set()
    );
  });

  it('treats nullish registry results as empty arrays', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      // These are intentionally non-Promise nullish returns to exercise `?.() ?? []` fallbacks.
      getLabelRegistry: vi.fn().mockReturnValue(null),
      getAreaRegistry: vi.fn().mockReturnValue(undefined),
      getDeviceRegistry: vi.fn().mockReturnValue(null),
      getEntityRegistry: vi.fn().mockReturnValue(undefined),
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    await expect(service.getAllAreas()).resolves.toEqual([]);
    await expect(service.getHouseholdDeviceIdsByAreaId('area_x')).resolves.toEqual(new Set());
  });

  it('handles registry parsing edge cases and kind matching', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry: vi.fn().mockResolvedValue([
        // invalid row ignored
        'nope',
        { label_id: 'label_household', name: 'Household' },
      ]),
      getAreaRegistry: vi.fn().mockResolvedValue([
        // Invalid entries ignored.
        { area_id: null, name: 'Nope' },
        { area_id: 'area_a', name: 'Area A' },
      ]),
      // Non-array should be treated as empty.
      getDeviceRegistry: vi.fn().mockResolvedValue({} as unknown as unknown[]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        // Unsupported domain should be ignored (even if household-labeled).
        { entity_id: 'switch.area_a_humidity', area_id: 'area_a', labels: ['label_household'] },
        // Dot-less entity_id should be treated as unsupported domain.
        { entity_id: 'temperature', area_id: 'area_a', labels: ['label_household'] },
        // humid keyword path
        { entity_id: 'sensor.area_a_humid', area_id: 'area_a', labels: ['label_household'] },
        // temp keyword path
        { entity_id: 'sensor.area_a_temp', area_id: 'area_a', labels: ['label_household'] },
        // light domain path
        { entity_id: 'light.area_a_main', area_id: 'area_a', labels: ['label_household'] },
        // invalid entity id ignored
        { entity_id: null, area_id: 'area_a', labels: ['label_household'] },
        // missing effective area id ignored
        { entity_id: 'sensor.no_area', labels: ['label_household'] },
      ]),
    };

    const service = new HomeAssistantHouseholdAreaEntityIndexService(
      client as IHomeAssistantClient
    );

    const areas = await service.getAllAreas();
    expect(areas).toEqual([{ areaId: 'area_a', name: 'Area A' }]);

    const devices = await service.getHouseholdDeviceIdsByAreaId('area_a');
    expect(Array.from(devices)).toEqual([]);

    const humid = await service.getHouseholdEntityIdsByAreaId('area_a', 'humidity');
    expect(Array.from(humid)).toEqual(['sensor.area_a_humid']);

    const temp = await service.getHouseholdEntityIdsByAreaId('area_a', 'temperature');
    expect(Array.from(temp)).toEqual(['sensor.area_a_temp']);

    const lights = await service.getHouseholdEntityIdsByAreaId('area_a', 'light');
    expect(Array.from(lights)).toEqual(['light.area_a_main']);
  });
});
