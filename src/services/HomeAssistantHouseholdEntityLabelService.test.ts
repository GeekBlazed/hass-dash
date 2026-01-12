import { describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { HomeAssistantHouseholdEntityLabelService } from './HomeAssistantHouseholdEntityLabelService';

describe('HomeAssistantHouseholdEntityLabelService', () => {
  it('returns empty set when Household label is not present', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(false);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry: vi.fn().mockResolvedValue([{ label_id: 'x', name: 'Other' }]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        { entity_id: 'sensor.kitchen_temperature', labels: ['x'] },
      ]),
    };

    const service = new HomeAssistantHouseholdEntityLabelService(client as IHomeAssistantClient);
    const ids = await service.getHouseholdEntityIds();

    expect(ids.size).toBe(0);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('returns entity ids labeled Household (case-insensitive name match)', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry: vi.fn().mockResolvedValue([
        { label_id: 'label_household', name: 'Household' },
        { label_id: 'label_other', name: 'Other' },
      ]),
      getEntityRegistry: vi.fn().mockResolvedValue([
        { entity_id: 'sensor.family_room_temperature_household', labels: ['label_household'] },
        { entity_id: 'sensor.garage_temperature', labels: ['label_other'] },
        // invalid shapes should be ignored
        { entity_id: 123, labels: ['label_household'] },
        { entity_id: 'sensor.no_labels' },
      ]),
    };

    const service = new HomeAssistantHouseholdEntityLabelService(client as IHomeAssistantClient);
    const ids = await service.getHouseholdEntityIds();

    expect(connect).not.toHaveBeenCalled();
    expect(Array.from(ids)).toEqual(['sensor.family_room_temperature_household']);
  });

  it('caches results within TTL and returns a defensive copy', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1001).mockReturnValueOnce(1002);

    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    const getLabelRegistry = vi
      .fn()
      .mockResolvedValue([{ label_id: 'label_household', name: 'Household' }]);
    const getEntityRegistry = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.kitchen_temperature', labels: ['label_household'] },
    ]);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry,
      getEntityRegistry,
    };

    const service = new HomeAssistantHouseholdEntityLabelService(client as IHomeAssistantClient);

    const first = await service.getHouseholdEntityIds();
    expect(getLabelRegistry).toHaveBeenCalledTimes(1);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);

    // Mutate the returned set; internal cache should not be affected.
    first.add('sensor.should_not_pollute_cache');

    const second = await service.getHouseholdEntityIds();
    expect(getLabelRegistry).toHaveBeenCalledTimes(1);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);

    expect(second.has('sensor.kitchen_temperature')).toBe(true);
    expect(second.has('sensor.should_not_pollute_cache')).toBe(false);

    nowSpy.mockRestore();
  });

  it('dedupes concurrent calls with an in-flight promise', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const isConnected = vi.fn().mockReturnValue(true);

    let resolveLabelRegistry!: (value: unknown[]) => void;
    const labelRegistryPromise = new Promise<unknown[]>((resolve) => {
      resolveLabelRegistry = (value) => resolve(value);
    });

    const getLabelRegistry = vi.fn().mockReturnValue(labelRegistryPromise);
    const getEntityRegistry = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.kitchen_temperature', labels: ['label_household'] },
    ]);

    const client: Partial<IHomeAssistantClient> = {
      connect,
      isConnected,
      getLabelRegistry,
      getEntityRegistry,
    };

    const service = new HomeAssistantHouseholdEntityLabelService(client as IHomeAssistantClient);

    const p1 = service.getHouseholdEntityIds();
    const p2 = service.getHouseholdEntityIds();

    expect(getLabelRegistry).toHaveBeenCalledTimes(1);
    resolveLabelRegistry([{ label_id: 'label_household', name: 'Household' }]);

    const [ids1, ids2] = await Promise.all([p1, p2]);

    expect(ids1.has('sensor.kitchen_temperature')).toBe(true);
    expect(ids2.has('sensor.kitchen_temperature')).toBe(true);
    expect(getEntityRegistry).toHaveBeenCalledTimes(1);
  });
});
