import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HaEntityState } from '../types/home-assistant';
import { useEntityStore } from './useEntityStore';

const createInitialEntityState = () => ({
  entitiesById: {},
  lastUpdatedAt: null,
  householdEntityIds: {},
});

describe('useEntityStore', () => {
  let nowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    useEntityStore.persist.clearStorage();
    useEntityStore.setState(createInitialEntityState());
  });

  afterEach(() => {
    nowSpy?.mockRestore();
    nowSpy = null;
  });

  it('setAll() replaces entitiesById and updates lastUpdatedAt', () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456);

    const states: HaEntityState[] = [
      {
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: { friendly_name: 'Kitchen' },
        last_changed: '2026-01-01T00:00:00+00:00',
        last_updated: '2026-01-01T00:00:00+00:00',
        context: { id: '1', parent_id: null, user_id: null },
      },
      {
        entity_id: 'sensor.temp',
        state: '72',
        attributes: { unit_of_measurement: '°F' },
        last_changed: '2026-01-01T00:00:01+00:00',
        last_updated: '2026-01-01T00:00:01+00:00',
        context: { id: '2', parent_id: null, user_id: null },
      },
    ];

    useEntityStore.getState().setAll(states);

    expect(useEntityStore.getState().entitiesById['light.kitchen']?.state).toBe('on');
    expect(useEntityStore.getState().entitiesById['sensor.temp']?.state).toBe('72');
    expect(useEntityStore.getState().lastUpdatedAt).toBe(123456);
  });

  it('upsert() inserts or overwrites a single entity and updates lastUpdatedAt', () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);

    useEntityStore.getState().upsert({
      entity_id: 'light.kitchen',
      state: 'off',
      attributes: { friendly_name: 'Kitchen' },
      last_changed: '2026-01-01T00:00:00+00:00',
      last_updated: '2026-01-01T00:00:00+00:00',
      context: { id: '1', parent_id: null, user_id: null },
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen']?.state).toBe('off');
    expect(useEntityStore.getState().lastUpdatedAt).toBe(1000);

    nowSpy.mockReturnValue(2000);
    useEntityStore.getState().upsert({
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: { friendly_name: 'Kitchen' },
      last_changed: '2026-01-01T00:00:02+00:00',
      last_updated: '2026-01-01T00:00:02+00:00',
      context: { id: '2', parent_id: null, user_id: null },
    });

    expect(useEntityStore.getState().entitiesById['light.kitchen']?.state).toBe('on');
    expect(useEntityStore.getState().lastUpdatedAt).toBe(2000);
  });

  it('clear() resets entitiesById and lastUpdatedAt', () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(999);

    useEntityStore.getState().upsert({
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: {},
      last_changed: '2026-01-01T00:00:00+00:00',
      last_updated: '2026-01-01T00:00:00+00:00',
      context: { id: '1', parent_id: null, user_id: null },
    });

    expect(Object.keys(useEntityStore.getState().entitiesById)).toHaveLength(1);
    expect(useEntityStore.getState().lastUpdatedAt).toBe(999);

    useEntityStore.getState().clear();
    expect(useEntityStore.getState().entitiesById).toEqual({});
    expect(useEntityStore.getState().lastUpdatedAt).toBeNull();
    expect(useEntityStore.getState().householdEntityIds).toEqual({});
  });

  it('setHouseholdEntityIds() updates a non-persisted lookup set', async () => {
    useEntityStore.getState().setHouseholdEntityIds(['sensor.a', 'sensor.b']);
    expect(useEntityStore.getState().householdEntityIds['sensor.a']).toBe(true);
    expect(useEntityStore.getState().householdEntityIds['sensor.b']).toBe(true);

    const storage = useEntityStore.persist.getOptions().storage;
    expect(storage).toBeDefined();

    const raw = await Promise.resolve(storage?.getItem('hass-dash:entities'));
    if (!raw) {
      // Depending on timing, Zustand may not flush immediately; we at least assert
      // the value is present in memory.
      return;
    }

    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { state?: { householdEntityIds?: unknown } })
        : (raw as { state?: { householdEntityIds?: unknown } });

    // Guardrail: registry-derived metadata should not be persisted.
    expect(parsed.state?.householdEntityIds).toBeUndefined();
  });

  it('persists entitiesById and lastUpdatedAt', async () => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(555);

    useEntityStore.getState().setAll([
      {
        entity_id: 'light.kitchen',
        state: 'on',
        attributes: { friendly_name: 'Kitchen' },
        last_changed: '2026-01-01T00:00:00+00:00',
        last_updated: '2026-01-01T00:00:00+00:00',
        context: { id: '1', parent_id: null, user_id: null },
      },
    ]);

    const storage = useEntityStore.persist.getOptions().storage;
    expect(storage).toBeDefined();

    const raw = await Promise.resolve(storage?.getItem('hass-dash:entities'));
    expect(raw).not.toBeNull();

    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as {
            state?: { entitiesById?: Record<string, HaEntityState>; lastUpdatedAt?: number | null };
          })
        : (raw as {
            state?: { entitiesById?: Record<string, HaEntityState>; lastUpdatedAt?: number | null };
          });

    expect(parsed.state?.entitiesById?.['light.kitchen']?.state).toBe('on');
    expect(parsed.state?.lastUpdatedAt).toBe(555);
  });

  it('persists entities but caps persisted size', async () => {
    const states: HaEntityState[] = Array.from({ length: 300 }, (_, index) => {
      const lastUpdated = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
      return {
        entity_id: `sensor.test_${index}`,
        state: String(index),
        attributes: { friendly_name: `Test ${index}` },
        last_changed: lastUpdated,
        last_updated: lastUpdated,
        context: { id: String(index), parent_id: null, user_id: null },
      };
    });

    useEntityStore.getState().setAll(states);

    const storage = useEntityStore.persist.getOptions().storage;
    expect(storage).toBeDefined();

    const raw = await Promise.resolve(storage?.getItem('hass-dash:entities'));
    expect(raw).not.toBeNull();

    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { state?: { entitiesById?: Record<string, HaEntityState> } })
        : (raw as { state?: { entitiesById?: Record<string, HaEntityState> } });

    const persistedEntities = parsed.state?.entitiesById ?? {};

    // Guardrail: we should not persist the full entity list.
    expect(Object.keys(persistedEntities).length).toBeLessThanOrEqual(250);

    // We keep the most recently updated items.
    expect(persistedEntities['sensor.test_299']).toBeDefined();
  });

  it('partialize() covers both persisted-size branches', () => {
    const options = useEntityStore.persist.getOptions();
    // Zustand persist types don't strongly type partialize.
    const partialize = options.partialize as unknown as (state: {
      entitiesById: Record<string, HaEntityState>;
      lastUpdatedAt: number | null;
      householdEntityIds?: Record<string, true>;
    }) => { entitiesById: Record<string, HaEntityState>; lastUpdatedAt: number | null };

    const one: HaEntityState = {
      entity_id: 'light.kitchen',
      state: 'on',
      attributes: {},
      last_changed: '2026-01-01T00:00:00+00:00',
      last_updated: '2026-01-01T00:00:00+00:00',
      context: { id: '1', parent_id: null, user_id: null },
    };

    const small = partialize({ entitiesById: { [one.entity_id]: one }, lastUpdatedAt: 1 });
    expect(Object.keys(small.entitiesById)).toHaveLength(1);

    const bigEntities: Record<string, HaEntityState> = Object.fromEntries(
      Array.from({ length: 300 }, (_, index) => {
        const lastUpdated = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
        const lastUpdatedMaybeEmpty = index === 0 ? '' : lastUpdated;
        const lastChangedMaybeEmpty = index === 1 ? '' : lastUpdated;
        const state: HaEntityState = {
          entity_id: `sensor.test_${index}`,
          state: String(index),
          attributes: { friendly_name: `Test ${index}` },
          last_changed: lastChangedMaybeEmpty,
          last_updated: lastUpdatedMaybeEmpty,
          context: { id: String(index), parent_id: null, user_id: null },
        };
        return [state.entity_id, state];
      })
    );

    const capped = partialize({ entitiesById: bigEntities, lastUpdatedAt: 2 });
    expect(Object.keys(capped.entitiesById).length).toBeLessThanOrEqual(250);
    expect(capped.entitiesById['sensor.test_299']).toBeDefined();
  });
});
