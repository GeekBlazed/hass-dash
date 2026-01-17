import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntityStore } from '../../stores/useEntityStore';
import { useHouseholdAreaEntityIndexStore } from '../../stores/useHouseholdAreaEntityIndexStore';
import type { HaEntityState } from '../../types/home-assistant';
import { HaAreaClimateOverlayBridge } from './HaAreaClimateOverlayBridge';

type MakeSensorOptions = {
  includeHousehold?: boolean;
  friendlyName?: string;
  labels?: string[];
};

const makeSensor = (
  entityId: string,
  value: number,
  unit: string | undefined,
  options: MakeSensorOptions = {}
): HaEntityState => {
  const includeHousehold = options.includeHousehold ?? true;
  const friendlyName = options.friendlyName;
  const labels = options.labels;

  const baseAttributes: Record<string, unknown> = unit ? { unit_of_measurement: unit } : {};
  if (typeof friendlyName === 'string') {
    baseAttributes.friendly_name = friendlyName;
  } else if (includeHousehold) {
    baseAttributes.friendly_name = `Household ${entityId}`;
  }
  if (labels) {
    baseAttributes.labels = labels;
  }

  return {
    entity_id: entityId,
    state: String(value),
    attributes: baseAttributes,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('HaAreaClimateOverlayBridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useEntityStore.getState().clear();
    useHouseholdAreaEntityIndexStore.getState().clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('creates and updates room climate labels from HA entity state', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_temperature', 72.4, '°F'));
    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_humidity', 40.2, '%'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F • 40%');
  });

  it('can fall back to a best-matching temperature sensor name', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    // Not the default sensor.kitchen_temperature, but still clearly a kitchen temperature sensor.
    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_sensor_temperature', 71.6, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('unhides an existing climate label when the climate overlay is visible', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
            <text class="room-climate is-hidden" data-room-id="kitchen" x="5" y="5">—</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_temperature', 72.4, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
    expect(el?.classList.contains('is-hidden')).toBe(false);
  });

  it('removes climate label when values disappear', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="office">
            <text class="room-label" x="2" y="3">Office</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.office_temperature', 70, '°F'));

    const { rerender } = render(<HaAreaClimateOverlayBridge />);

    expect(
      document.querySelector('#labels-layer text.room-climate[data-room-id="office"]')
    ).not.toBeNull();

    // Clear entities and force rerender to run effect with updated store snapshot.
    act(() => {
      useEntityStore.getState().clear();
      rerender(<HaAreaClimateOverlayBridge />);
    });

    expect(
      document.querySelector('#labels-layer text.room-climate[data-room-id="office"]')
    ).toBeNull();
  });

  it('falls back to °F when temperature sensor has no unit', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_temperature', 72.4, undefined));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('creates climate label hidden when the climate overlay is hidden', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel is-hidden"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="office">
            <text class="room-label" x="2" y="3">Office</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.office_temperature', 70, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="office"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.classList.contains('is-hidden')).toBe(true);
  });

  it('uses configured mapping when VITE_HA_AREA_CLIMATE_ENTITY_MAP is set', () => {
    vi.stubEnv(
      'VITE_HA_AREA_CLIMATE_ENTITY_MAP',
      JSON.stringify({
        office: {
          temperature: 'sensor.office_temp_custom',
          humidity: 'sensor.office_humidity_custom',
        },
      })
    );

    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="office">
            <text class="room-label" x="2" y="3">Office</text>
          </g>
        </g>
      </svg>
    `;

    // Add both the default-heuristic sensors and the mapped sensors. The bridge
    // should prefer the explicitly configured ones.
    useEntityStore.getState().upsert(makeSensor('sensor.office_temperature', 70, '°F'));
    useEntityStore.getState().upsert(makeSensor('sensor.office_humidity', 40, '%'));
    // Demonstrate label extraction via `attributes.labels` (not only friendly_name).
    useEntityStore.getState().upsert(
      makeSensor('sensor.office_temp_custom', 68, '°F', {
        includeHousehold: false,
        labels: ['Household'],
      })
    );
    useEntityStore.getState().upsert(
      makeSensor('sensor.office_humidity_custom', 33, '%', {
        includeHousehold: false,
        labels: ['Household'],
      })
    );

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="office"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('68°F • 33%');
  });

  it('ignores non-household temperature sensors when multiple match the same room', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="family_room">
            <text class="room-label" x="5" y="5">Family Room</text>
          </g>
        </g>
      </svg>
    `;

    // A device-specific thermometer that should not be used.
    useEntityStore
      .getState()
      .upsert(makeSensor('sensor.family_room_temperature', 125, '°F', { includeHousehold: false }));

    // The intended household reading.
    useEntityStore
      .getState()
      .upsert(makeSensor('sensor.family_room_temperature_household', 72, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="family_room"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('shows temperatures even when HA entity state has no labels', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="family_room">
            <text class="room-label" x="5" y="5">Family Room</text>
          </g>
        </g>
      </svg>
    `;

    // Real-world example: entity registry labels are not included in the state payload,
    // but the object_id clearly identifies the room and sensor kind.
    useEntityStore.getState().upsert(
      makeSensor('sensor.apollo_msr2_family_room_dps310_temperature', 81.179, '°F', {
        includeHousehold: false,
        friendlyName: 'Family Room Temperature',
      })
    );

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="family_room"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('81°F');
  });

  it('disconnects its MutationObserver on unmount', () => {
    const disconnect = vi.fn();
    const observe = vi.fn();

    let lastCallback: MutationCallback | null = null;

    class MockMutationObserver {
      constructor(cb: MutationCallback) {
        lastCallback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    }

    vi.stubGlobal('MutationObserver', MockMutationObserver);

    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_temperature', 72, '°F'));

    const { unmount } = render(<HaAreaClimateOverlayBridge />);

    // Ensure the observer callback path runs (covers `apply()` inside the callback).
    expect(lastCallback).not.toBeNull();
    act(() => {
      lastCallback?.([], observe as unknown as MutationObserver);
    });

    unmount();

    expect(observe).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('can fall back using normalized room ids and temp tokens', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="Living-Room">
            <text class="room-label" x="5" y="5">Living Room</text>
          </g>
        </g>
      </svg>
    `;

    // Invalid entity id format (extra dot) should be ignored by fallback matching.
    useEntityStore.getState().upsert(makeSensor('sensor.living.room_temp', 1, '°F'));
    // Uses _temp token (not temperature) and underscores, but is not an exact
    // default candidate id (e.g. sensor.<room>_temp) so fallback logic must run.
    useEntityStore.getState().upsert(makeSensor('sensor.living_room_temp_sensor', 71.6, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="Living-Room"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('can fall back when the room id is at the end of the object_id', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    // Not a default candidate like `sensor.kitchen_temperature`, but still clearly
    // matches the room and temperature keyword.
    useEntityStore.getState().upsert(makeSensor('sensor.temperature_kitchen', 71.6, '°F'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('can fall back to a best-matching humidity sensor name', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    // Not the default sensor.kitchen_humidity, but still clearly a kitchen humidity sensor.
    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_sensor_humidity', 40.2, '%'));

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('40%');
  });

  it('does not crash when labels-layer is missing or not an SVG <g>', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <div id="labels-layer"></div>
    `;

    useEntityStore.getState().upsert(makeSensor('sensor.kitchen_temperature', 72.4, '°F'));

    expect(() => {
      render(<HaAreaClimateOverlayBridge />);
    }).not.toThrow();
  });

  it('falls back to the HA area registry index when room-id heuristics fail', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    // These ids intentionally do NOT include "kitchen" so the object_id heuristics fail.
    useEntityStore.getState().upsert(makeSensor('sensor.ambient_temperature', 71.6, '°F'));
    useEntityStore.getState().upsert(makeSensor('sensor.ambient_humidity', 40.2, '%'));

    useHouseholdAreaEntityIndexStore.getState().setIndex({
      areaNameById: {
        area_kitchen: 'Kitchen',
      },
      householdDeviceIdsByAreaId: {
        area_kitchen: [],
      },
      householdEntityIdsByAreaId: {
        area_kitchen: {
          temperature: ['sensor.ambient_temperature'],
          humidity: ['sensor.ambient_humidity'],
          light: [],
        },
      },
    });

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="kitchen"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F • 40%');
  });

  it('uses entity-registry household ids and disables attribute fallback when present', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="family_room">
            <text class="room-label" x="5" y="5">Family Room</text>
          </g>
        </g>
      </svg>
    `;

    // Mark ONLY this entity as a household entity via the entity registry list.
    // This makes `allowAttributeFallback` false inside the bridge.
    useEntityStore.getState().setHouseholdEntityIds(['sensor.family_room_temperature_household']);

    // This one is NOT in the householdEntityIds list, but has a household-y friendly_name.
    // With allowAttributeFallback=false it should not be treated as household.
    useEntityStore
      .getState()
      .upsert(makeSensor('sensor.family_room_temperature', 125, '°F', { includeHousehold: true }));
    useEntityStore
      .getState()
      .upsert(
        makeSensor('sensor.family_room_temperature_household', 72, '°F', {
          includeHousehold: false,
        })
      );

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="family_room"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('72°F');
  });

  it('detects household label from attributes.name when allowed', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="office">
            <text class="room-label" x="2" y="3">Office</text>
          </g>
        </g>
      </svg>
    `;

    // allowAttributeFallback remains true because householdEntityIds is empty.
    const entity: HaEntityState = {
      entity_id: 'sensor.office_temperature',
      state: '70',
      attributes: {
        // Not using friendly_name here on purpose.
        name: 'Household Office Temperature',
        unit_of_measurement: '°F',
      },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      context: { id: 'c', parent_id: null, user_id: null },
    };

    useEntityStore.getState().upsert(entity);

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="office"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('70°F');
  });

  it('ignores sensors with non-numeric state', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    const bad: HaEntityState = {
      entity_id: 'sensor.kitchen_temperature',
      state: 'unknown',
      attributes: { unit_of_measurement: '°F' },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      context: { id: 'c', parent_id: null, user_id: null },
    };

    useEntityStore.getState().upsert(bad);

    render(<HaAreaClimateOverlayBridge />);

    expect(
      document.querySelector('#labels-layer text.room-climate[data-room-id="kitchen"]')
    ).toBeNull();
  });

  it('handles undefined entity entries without creating climate labels', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="5" y="5">Kitchen</text>
          </g>
        </g>
      </svg>
    `;

    // Force an intentionally-invalid store snapshot to exercise defensive branches.
    useEntityStore.setState({
      entitiesById: {
        'sensor.kitchen_temperature': undefined as unknown as HaEntityState,
      },
      householdEntityIds: {},
      lastUpdatedAt: null,
    });

    expect(() => {
      render(<HaAreaClimateOverlayBridge />);
    }).not.toThrow();

    expect(
      document.querySelector('#labels-layer text.room-climate[data-room-id="kitchen"]')
    ).toBeNull();
  });

  it('can match sensors by device_class even when unit does not indicate kind', () => {
    document.body.innerHTML = `
      <section id="climate-panel" class="tile climate-panel"></section>
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="office">
            <text class="room-label" x="2" y="3">Office</text>
          </g>
        </g>
      </svg>
    `;

    const temp: HaEntityState = {
      entity_id: 'sensor.office_temperature',
      state: '69.1',
      attributes: {
        device_class: 'temperature',
        // Intentionally omit the degree sign to ensure `device_class` is used.
        unit_of_measurement: 'C',
        friendly_name: 'Household Office Temp',
      },
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      context: { id: 'c', parent_id: null, user_id: null },
    };

    useEntityStore.getState().upsert(temp);

    render(<HaAreaClimateOverlayBridge />);

    const el = document.querySelector(
      '#labels-layer text.room-climate[data-room-id="office"]'
    ) as SVGTextElement | null;

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('69C');
  });
});
