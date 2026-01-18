import { act, render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import type { IHomeAssistantClient } from '../../../interfaces/IHomeAssistantClient';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { HaRoomLightingOverlayBridge } from './HaRoomLightingOverlayBridge';

const makeLight = (entityId: string, state: 'on' | 'off', friendlyName?: string): HaEntityState => {
  const attrs: Record<string, unknown> = {};
  if (friendlyName) attrs.friendly_name = friendlyName;

  return {
    entity_id: entityId,
    state,
    attributes: attrs,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('HaRoomLightingOverlayBridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Ensure debug query flags don't leak between tests.
    window.history.replaceState({}, '', '/');
    useEntityStore.getState().clear();

    // jsdom in this environment doesn't implement elementFromPoint, but the
    // delegated pointer handlers rely on it.
    (
      document as unknown as { elementFromPoint?: (x: number, y: number) => Element | null }
    ).elementFromPoint = vi.fn(() => null);

    useDashboardStore.getState().setFloorplanLoaded({
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              points: [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
              ],
            },
          ],
        },
      ],
    });

    useDashboardStore.getState().setActivePanel('lighting');
  });

  it('removes non-managed toggles from the lights layer on mount', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer">
          <g class="light-toggle" data-room-id="kitchen"></g>
        </g>
      </svg>
    `;

    useEntityStore.getState().setHouseholdEntityIds(new Set(['light.kitchen_ceiling']));
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const mockClient: Partial<IHomeAssistantClient> = {
      connect: vi.fn().mockResolvedValue(undefined),
      callService: vi.fn().mockResolvedValue(undefined),
    };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    expect(document.querySelector('#lights-layer g.light-toggle:not([data-hassdash])')).toBeNull();
    expect(document.querySelector('#lights-layer g.light-toggle[data-hassdash]')).not.toBeNull();

    getSpy.mockRestore();
  });

  it('logs and skips invoke when a toggle has no entity ids (debugLights)', async () => {
    window.history.replaceState({}, '', '/?debugLights=1');

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // Force the "no entity ids" branch.
    toggle?.setAttribute('data-entity-ids', '');

    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
    });

    // Allow async invoke to run (even though it should early-return).
    await act(async () => {
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(0);
    expect(infoSpy).toHaveBeenCalled();

    infoSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('rolls back optimistic updates and logs non-Error failures', async () => {
    window.history.replaceState({}, '', '/?debugLights=1');

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    // Reject with a non-Error to exercise the `error instanceof Error ? ... : String(error)` branch.
    const callService = vi.fn().mockRejectedValue('boom');
    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // Include a "phantom" entity id so the rollback loop hits the
    // `typeof prev === 'string'` false branch.
    toggle?.setAttribute('data-entity-ids', 'light.kitchen_ceiling,light.unknown');

    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
    });

    // Allow invoke promise chain to run through the rejection + rollback.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Rollback should have happened.
    expect(toggle?.classList.contains('is-on')).toBe(false);
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');
    expect(callService).toHaveBeenCalledTimes(1);

    getSpy.mockRestore();
  });

  it('removes stale hassdash toggles when there are no room light groups', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer">
          <g class="light-toggle" data-hassdash="1" data-room-id="kitchen"></g>
        </g>
      </svg>
    `;

    // Intentionally do NOT upsert any `light.*` entities so no room light groups exist.
    useEntityStore.getState().upsert({
      entity_id: 'sensor.any',
      state: '1',
      attributes: {},
      last_changed: '2026-01-01T00:00:00Z',
      last_updated: '2026-01-01T00:00:00Z',
      context: { id: 'c', parent_id: null, user_id: null },
    });

    render(<HaRoomLightingOverlayBridge />);

    // The bridge should remove hassdash-created toggles when no groups are desired.
    expect(document.querySelector('#lights-layer g.light-toggle[data-hassdash]')).toBeNull();
  });

  it('positions a room light toggle under the DOM room label (x/y) instead of the room centroid', () => {
    // Use a room shape whose centroid does not match the label coordinates.
    useDashboardStore.getState().setFloorplanLoaded({
      defaultFloorId: 'ground',
      floors: [
        {
          id: 'ground',
          name: 'Ground',
          rooms: [
            {
              id: 'kitchen',
              name: 'Kitchen',
              points: [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
              ],
            },
          ],
        },
      ],
    });

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="2">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('data-cx')).toBe('1');
    expect(toggle?.getAttribute('data-cy')).toBe('2');
  });

  it('uses getBBox when available to compute label anchor positioning', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    const text = document.querySelector('text.room-label') as unknown as {
      getBBox?: () => DOMRect;
    };
    const originalGetBBox = text.getBBox;
    text.getBBox = () => ({ x: 2, y: 3, width: 4, height: 5 }) as unknown as DOMRect;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();
    // cx = x + width/2 = 2 + 2 = 4, cy = y + height = 3 + 5 = 8
    expect(toggle?.getAttribute('data-cx')).toBe('4');
    expect(toggle?.getAttribute('data-cy')).toBe('8');

    text.getBBox = originalGetBBox;
  });

  it('invokes toggle on delegated pointerdown + pointerup (record path)', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
    });

    // Optimistic UI should flip immediately.
    expect(toggle?.classList.contains('is-on')).toBe(true);
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('on');

    // Allow async invoke to run.
    await act(async () => {
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });

  it('does not invoke on delegated pointerup when pointer moves too far', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = {
      connect: vi.fn().mockResolvedValue(undefined),
      callService,
    };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 })
      );
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 50, clientY: 0 })
      );
      await Promise.resolve();
    });

    expect(toggle?.classList.contains('is-on')).toBe(false);
    expect(callService).toHaveBeenCalledTimes(0);
    getSpy.mockRestore();
  });

  it('does not invoke on delegated pointerup when press duration is too long', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = {
      connect: vi.fn().mockResolvedValue(undefined),
      callService,
    };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const nowSpy = vi.spyOn(Date, 'now');
    let now = 0;
    nowSpy.mockImplementation(() => now);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      now = 0;
      toggle?.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 })
      );
      now = 1000;
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 })
      );
      await Promise.resolve();
    });

    expect(toggle?.classList.contains('is-on')).toBe(false);
    expect(callService).toHaveBeenCalledTimes(0);

    nowSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('invokes toggle on delegated pointerup fallback when there is no pointerdown record', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // No pointerdown first, pointerup should still invoke via fallback.
    await act(async () => {
      toggle?.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 10, clientY: 10 })
      );
    });

    expect(toggle?.classList.contains('is-on')).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });

  it('throttles rapid repeated invokes on the same toggle', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });

  it('cancels a pending resize animation frame on unmount', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 123 as unknown as number);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      return;
    });

    const { unmount } = render(<HaRoomLightingOverlayBridge />);

    // Trigger a resize; the bridge should schedule a requestAnimationFrame.
    window.dispatchEvent(new Event('resize'));
    expect(rafSpy).toHaveBeenCalledTimes(1);

    unmount();

    // Cleanup should cancel the pending rAF.
    expect(cancelSpy).toHaveBeenCalledWith(123);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it('disconnects ResizeObserver when available', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const observe = vi.fn();
    const disconnect = vi.fn();

    class FakeResizeObserver {
      observe = observe;
      disconnect = disconnect;
    }

    const original = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;

    try {
      const { unmount } = render(<HaRoomLightingOverlayBridge />);
      expect(observe).toHaveBeenCalledTimes(1);
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = original;
    }
  });

  it('removes stale existing hassdash toggles for rooms that no longer have desired HA light groups', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer">
          <g class="light-toggle" data-hassdash="1" data-room-id="stale-room"></g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    expect(
      document.querySelector('#lights-layer g.light-toggle[data-room-id="stale-room"]')
    ).toBeNull();
  });

  it('schedules a resize when ResizeObserver callback fires', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 123 as unknown as number;
      });

    type LocalResizeObserverCallback = (entries: unknown[], observer: unknown) => void;
    let callback: LocalResizeObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();

    class FakeResizeObserver {
      constructor(cb: LocalResizeObserverCallback) {
        callback = cb;
      }

      observe = observe;
      disconnect = disconnect;
    }

    const original = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;

    try {
      render(<HaRoomLightingOverlayBridge />);
      expect(observe).toHaveBeenCalledTimes(1);

      if (!callback) {
        throw new Error('Expected ResizeObserver callback to be captured');
      }
      (callback as unknown as LocalResizeObserverCallback)([], {});

      // The callback should schedule a resize via rAF.
      expect(rafSpy).toHaveBeenCalled();
    } finally {
      (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = original;
      rafSpy.mockRestore();
    }
  });

  it('applies sizing/transform to light toggles when svg has a measurable bounding box', () => {
    const globals = globalThis as unknown as {
      SVGRectElement?: unknown;
      SVGUseElement?: unknown;
    };
    const originalSvgRectElement = globals.SVGRectElement;
    const originalSvgUseElement = globals.SVGUseElement;
    // jsdom in this environment may not define these constructors; the bridge
    // uses instanceof checks.
    globals.SVGRectElement = (window as unknown as { SVGElement?: unknown }).SVGElement ?? Element;
    globals.SVGUseElement = (window as unknown as { SVGElement?: unknown }).SVGElement ?? Element;

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;
    (svg as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        toJSON: () => {},
      }) as unknown as DOMRect;

    try {
      useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

      render(<HaRoomLightingOverlayBridge />);

      const toggle = document.querySelector(
        '#lights-layer g.light-toggle[data-room-id="kitchen"]'
      ) as SVGGElement | null;
      expect(toggle).not.toBeNull();

      // resizeLightToggles should apply a transform and size the rect/use elements.
      expect(toggle?.getAttribute('transform')).toContain('translate(');

      const bg = toggle?.querySelector('.light-toggle-bg') as SVGElement | null;
      const icon = toggle?.querySelector('.light-toggle-icon') as SVGElement | null;
      expect(bg).not.toBeNull();
      expect(icon).not.toBeNull();
      expect(bg?.getAttribute('width')).not.toBeNull();
      expect(icon?.getAttribute('width')).not.toBeNull();
    } finally {
      globals.SVGRectElement = originalSvgRectElement;
      globals.SVGUseElement = originalSvgUseElement;
    }
  });

  it('does not apply sizing/transform when svg viewBox is missing', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;
    (svg as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        toJSON: () => {},
      }) as unknown as DOMRect;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // Without a viewBox, resizeLightToggles exits early.
    expect(toggle?.getAttribute('transform')).toBeNull();
  });

  it('skips non-group and invalid-coordinate .light-toggle nodes during resize', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="lights-layer"></g>
        <g id="other-layer">
          <rect class="light-toggle"></rect>
          <g class="light-toggle" data-cx="nope" data-cy="2"></g>
        </g>
      </svg>
    `;

    const svg = document.getElementById('floorplan-svg') as unknown as SVGSVGElement;
    (svg as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        toJSON: () => {},
      }) as unknown as DOMRect;

    // Ensure the bridge runs the HA overlay effect and calls resizeLightToggles.
    useEntityStore.getState().upsert(makeLight('light.unmapped_room', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const invalidGroup = document.querySelector(
      '#other-layer g.light-toggle[data-cx="nope"]'
    ) as SVGGElement | null;
    expect(invalidGroup).not.toBeNull();

    // Skipped nodes should not have a transform applied.
    expect(invalidGroup?.getAttribute('transform')).toBeNull();
  });

  it('schedules a resize when the SVG viewBox attribute changes', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 123 as unknown as number;
      });

    render(<HaRoomLightingOverlayBridge />);

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();

    svg?.setAttribute('viewBox', '0 0 11 11');

    // Flush MutationObserver.
    await act(async () => {
      await Promise.resolve();
    });

    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it('does not overwrite optimistic toggle state when optimistic-until is still in the future', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer">
          <g
            class="light-toggle is-on"
            data-hassdash="1"
            data-room-id="kitchen"
            data-hassdash-bound="1"
            data-optimistic-until="9999999999999"
          ></g>
        </g>
      </svg>
    `;

    // The store indicates the light is currently off (group.anyOn = false), but
    // the toggle should keep its optimistic visual state.
    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-hassdash][data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();
    expect(toggle?.classList.contains('is-on')).toBe(true);
    expect(toggle?.getAttribute('data-optimistic-until')).toBe('9999999999999');
  });

  it('cancels a pending resize animation frame on unmount', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => {
      // Do not invoke the callback; keep rafId pending.
      return 123 as unknown as number;
    });
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      return;
    });

    const { unmount } = render(<HaRoomLightingOverlayBridge />);

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();

    svg?.setAttribute('viewBox', '0 0 11 11');

    // Flush MutationObserver so scheduleResize runs and stores rafId.
    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(cancelSpy).toHaveBeenCalledWith(123);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it('removes non-managed (non-hassdash) toggles when HA is enabled (debug path enabled)', () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, '', '/?debugLights=1');

    vi.stubEnv('VITE_LOG_LEVEL', 'debug');

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer">
          <g class="light-toggle" data-room-id="kitchen"></g>
        </g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    // Non-managed toggle should be removed.
    expect(document.querySelector('#lights-layer g.light-toggle:not([data-hassdash])')).toBeNull();

    // HA-backed toggle should exist.
    expect(
      document.querySelector('#lights-layer g.light-toggle[data-hassdash][data-room-id="kitchen"]')
    ).toBeTruthy();

    window.history.pushState({}, '', originalUrl);
  });

  it('logs debug capture events when enabled via query param', () => {
    const originalUrl = window.location.href;
    window.history.pushState({}, '', '/?debugLights=1');

    vi.stubEnv('VITE_LOG_LEVEL', 'debug');

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const groupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {
      return;
    });
    const tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {
      return;
    });
    const endSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {
      return;
    });

    const { unmount } = render(<HaRoomLightingOverlayBridge />);

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();

    // Trigger at least one debug capture log.
    svg?.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 1,
        clientY: 1,
      })
    );

    expect(groupSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
    expect(endSpy).toHaveBeenCalled();

    unmount();

    groupSpy.mockRestore();
    tableSpy.mockRestore();
    endSpy.mockRestore();

    window.history.pushState({}, '', originalUrl);
  });

  it('invokes toggle on Space keydown for accessibility', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });

  it('invokes toggle on Enter keydown for accessibility', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });

  it('does not invoke toggle on keydown when shouldInvokeToggle rejects rapid repeats', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = {
      connect: vi.fn().mockResolvedValue(undefined),
      callService,
    };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(2000);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // Make shouldInvokeToggle reject (Date.now - last < 350).
    toggle?.setAttribute('data-hassdash-last-invoke', '1900');

    await act(async () => {
      toggle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await Promise.resolve();
    });

    expect(callService).toHaveBeenCalledTimes(0);

    nowSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('does not overwrite optimistic toggle state while data-optimistic-until is in the future', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);
    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    // Click to set optimistic-until and flip UI.
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(toggle?.classList.contains('is-on')).toBe(true);
    expect(toggle?.getAttribute('data-optimistic-until')).not.toBeNull();

    // Simulate an external update that would normally re-render the toggle to OFF.
    // While optimistic-until is still in the future, the bridge should not overwrite.
    await act(async () => {
      useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toggle?.classList.contains('is-on')).toBe(true);
    expect(toggle?.getAttribute('data-optimistic-until')).not.toBeNull();

    nowSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('does not schedule multiple requestAnimationFrame callbacks when resize is triggered repeatedly', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 123 as unknown as number);

    render(<HaRoomLightingOverlayBridge />);

    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));

    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
  });

  it('does not use ResizeObserver when it is undefined', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const original = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = undefined;

    try {
      const { unmount } = render(<HaRoomLightingOverlayBridge />);
      unmount();
    } finally {
      (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = original;
    }
  });

  it('hides room light toggles when lighting panel is not active', () => {
    useDashboardStore.getState().setActivePanel('climate');

    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();
    expect(toggle?.classList.contains('is-hidden')).toBe(true);
  });

  it('optimistically updates toggle + store immediately, and rolls back on failure', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    let rejectCallService!: (reason: unknown) => void;
    const callServicePromise = new Promise<void>((_, reject) => {
      rejectCallService = reject;
    });
    const callService = vi.fn().mockReturnValue(callServicePromise);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;
    expect(toggle).not.toBeNull();

    const user = userEvent.setup();

    // Click should flip UI immediately.
    await user.click(toggle as unknown as Element);

    expect(toggle?.classList.contains('is-on')).toBe(true);
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('on');

    // Reject the pending HA call and wait for rollback.
    await act(async () => {
      rejectCallService(new Error('boom'));
      await callServicePromise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(toggle?.classList.contains('is-on')).toBe(false);
    expect(useEntityStore.getState().entitiesById['light.kitchen_ceiling']?.state).toBe('off');

    getSpy.mockRestore();
  });

  it('creates a room light toggle when matching lights exist', () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector('#lights-layer g.light-toggle[data-room-id="kitchen"]');
    expect(toggle).not.toBeNull();
  });

  it('calls Home Assistant to turn lights on when room is currently off', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'off'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_on',
      service_data: {
        entity_id: ['light.kitchen_ceiling'],
      },
      target: {
        entity_id: ['light.kitchen_ceiling'],
      },
    });

    getSpy.mockRestore();
  });

  it('calls Home Assistant to turn lights off when room is currently on', async () => {
    document.body.innerHTML = `
      <svg id="floorplan-svg" viewBox="0 0 10 10">
        <g id="labels-layer">
          <g class="room-label-group" data-room-id="kitchen">
            <text class="room-label" x="1" y="1">Kitchen</text>
          </g>
        </g>
        <g id="lights-layer"></g>
      </svg>
    `;

    useEntityStore.getState().upsert(makeLight('light.kitchen_ceiling', 'on'));

    const connect = vi.fn().mockResolvedValue(undefined);
    const callService = vi.fn().mockResolvedValue(undefined);

    const mockClient: Partial<IHomeAssistantClient> = { connect, callService };
    const getSpy = vi
      .spyOn(container, 'get')
      .mockReturnValue(mockClient as unknown as IHomeAssistantClient);

    render(<HaRoomLightingOverlayBridge />);

    const toggle = document.querySelector(
      '#lights-layer g.light-toggle[data-room-id="kitchen"]'
    ) as SVGGElement | null;

    expect(toggle).not.toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_off',
      service_data: {
        entity_id: ['light.kitchen_ceiling'],
      },
      target: {
        entity_id: ['light.kitchen_ceiling'],
      },
    });

    getSpy.mockRestore();
  });
});
