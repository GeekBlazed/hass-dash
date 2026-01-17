import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../../stores/useDeviceTrackerMetadataStore';
import { FloorplanSvg } from './FloorplanSvg';
import { TrackedDeviceMarkersBridge } from './TrackedDeviceMarkersBridge';

describe('TrackedDeviceMarkersBridge', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'xyz');
    vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '10');
    vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '30');
    useDeviceLocationStore.persist.clearStorage();
    useDeviceLocationStore.setState({ locationsByEntityId: {} });
    useDeviceTrackerMetadataStore.getState().clear();
  });

  it('prefers HA name/alias for marker label when available', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          alias: 'phone:jeremy',
          name: 'Jeremy',
        },
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const label = marker?.querySelector('text.device-label');
      expect(label?.textContent).toBe('Jeremy');
    });
  });

  it('falls back to HA alias for marker label when name is missing', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          alias: 'Jeremy Phone',
        },
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const label = marker?.querySelector('text.device-label');
      expect(label?.textContent).toBe('Jeremy Phone');
    });
  });

  it('renders a marker when store contains a location', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2, z: 3 },
        confidence: 80,
        lastSeen: '2026-01-07T09:15:53Z',
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');
    expect(layer).toBeTruthy();

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );

      expect(marker).toBeTruthy();
      // FloorplanSvg viewBox is 0 0 10 10 so yRender = 10 - y
      expect(marker?.getAttribute('transform')).toBe('translate(1 8)');
    });
  });

  it('renders an avatar image when metadata provides avatarUrl', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          name: 'Jeremy',
          avatarUrl: 'http://ha.example/avatar.jpg',
          initials: 'J',
        },
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const img = marker?.querySelector('image.device-avatar-image');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('href')).toBe('http://ha.example/avatar.jpg');

      const initials = marker?.querySelector('text.device-avatar-text');
      expect(initials).toBeTruthy();
      expect(initials?.getAttribute('display')).toBe('none');
    });
  });

  it('renders initials when metadata has no avatarUrl', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          name: 'Jeremy Smith',
          initials: 'JS',
        },
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const img = marker?.querySelector('image.device-avatar-image');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('display')).toBe('none');

      const initials = marker?.querySelector('text.device-avatar-text');
      expect(initials).toBeTruthy();
      expect(initials?.getAttribute('display')).toBe(null);
      expect(initials?.textContent).toBe('JS');
    });
  });

  it('computes initials from the preferred label when metadata does not provide initials', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          name: 'Jeremy Smith',
          // initials omitted intentionally
        },
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const img = marker?.querySelector('image.device-avatar-image');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('display')).toBe('none');

      const initials = marker?.querySelector('text.device-avatar-text');
      expect(initials).toBeTruthy();
      expect(initials?.getAttribute('display')).toBe(null);
      expect(initials?.textContent).toBe('JS');
    });
  });

  it('updates marker position when location updates', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 9, y: 8 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      ) as SVGGElement | null;

      expect(marker).toBeTruthy();
      expect(marker?.getAttribute('transform')).toBe('translate(9 2)');
    });
  });

  it('binds to an existing SVG marker and updates its transform', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    const layer = document.getElementById('devices-layer');
    expect(layer).toBeTruthy();

    // Simulate an existing marker
    const existing = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    existing.setAttribute('class', 'device-marker');
    existing.setAttribute('data-device-id', 'device_tracker.phone_jeremy');
    existing.setAttribute('transform', 'translate(2 3)');
    layer?.appendChild(existing);

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    await waitFor(() => {
      // viewBox 0 0 10 10 -> yRender = 10 - 2 = 8
      expect(existing.getAttribute('transform')).toBe('translate(1 8)');
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe('true');
    });

    // Force re-render by updating store.
    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 4, y: 5 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    await waitFor(() => {
      // viewBox 0 0 10 10 -> yRender = 10 - 5 = 5
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe('true');
      expect(existing.getAttribute('transform')).toBe('translate(4 5)');
    });
  });

  it('restores a bound marker with no original transform by removing the transform attribute', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    const layer = document.getElementById('devices-layer');
    expect(layer).toBeTruthy();

    const existing = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    existing.setAttribute('class', 'device-marker');
    existing.setAttribute('data-device-id', 'device_tracker.phone_jeremy');
    // Intentionally omit transform
    layer?.appendChild(existing);

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    await waitFor(() => {
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe('true');
      expect(existing.getAttribute('transform')).toBe('translate(1 8)');
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 4, y: 5 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    await waitFor(() => {
      // viewBox 0 0 10 10 -> yRender = 10 - 5 = 5
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe('true');
      expect(existing.getAttribute('transform')).toBe('translate(4 5)');
    });
  });

  it('keeps created tracking markers updated on subsequent location changes', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 4, y: 5 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });
    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();
      expect(marker?.getAttribute('transform')).toBe('translate(4 5)');
    });
  });

  it('hides a marker when its last update is stale', async () => {
    vi.useFakeTimers();
    try {
      // 0.001 minutes = 60ms
      vi.stubEnv('VITE_TRACKING_STALE_TIMEOUT_MINUTES', '0.001');
      // 0.0005 minutes = 30ms
      vi.stubEnv('VITE_TRACKING_STALE_WARNING_MINUTES', '0.0005');

      render(
        <>
          <FloorplanSvg />
          <TrackedDeviceMarkersBridge />
        </>
      );

      // Flush initial effects.
      await act(async () => {});

      act(() => {
        useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
          position: { x: 1, y: 2 },
          confidence: 80,
          lastSeen: undefined,
          receivedAt: Date.now(),
        });
      });

      // Flush marker sync after store update.
      await act(async () => {});

      const layer = document.getElementById('devices-layer');

      const markerBefore = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(markerBefore).toBeTruthy();

      // Before hide threshold, marker should be stale-styled.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31);
      });

      const markerStale = layer?.querySelector<SVGGElement>(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(markerStale).toBeTruthy();
      expect(markerStale?.classList.contains('device-marker--stale')).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30);
      });

      const markerAfter = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(markerAfter).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a dev-only debug label (xyz mode) when enabled', async () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'xyz');
    window.history.replaceState({}, '', '/?debugOverlay');

    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2, z: 3 },
        confidence: 80,
        lastSeen: '2026-01-07T09:15:53Z',
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const debug = marker?.querySelector('text[data-hass-dash-tracking-debug="true"]');
      expect(debug).toBeTruthy();

      const tspans = debug?.querySelectorAll('tspan');
      expect(tspans?.length).toBeGreaterThanOrEqual(2);
      expect(debug?.textContent).toContain('x=1.00 y=2.00 z=3.00');
      expect(debug?.textContent).toContain('conf=80');
      expect(debug?.textContent).toContain('last_seen=2026-01-07T09:15:53Z');
    });
  });

  it('renders a dev-only debug label (geo mode) when enabled', async () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'geo');
    window.history.replaceState({}, '', '/?debugOverlay');

    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        geo: { latitude: 40.123, longitude: -74.456, elevation: 12.5 },
        confidence: 80,
        lastSeen: '2026-01-07T09:15:53Z',
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const debug = marker?.querySelector('text[data-hass-dash-tracking-debug="true"]');
      expect(debug).toBeTruthy();

      const tspans = debug?.querySelectorAll('tspan');
      expect(tspans?.length).toBeGreaterThanOrEqual(2);
      expect(debug?.textContent).toContain('lat=40.12 lon=-74.46 ele=12.50');
      expect(debug?.textContent).toContain('conf=80');
      expect(debug?.textContent).toContain('last_seen=2026-01-07T09:15:53Z');
    });
  });

  it('removes debug label when debug overlay is disabled', async () => {
    vi.stubEnv('VITE_TRACKING_DEBUG_OVERLAY_MODE', 'xyz');
    window.history.replaceState({}, '', '/?debugOverlay');

    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2, z: 3 },
        confidence: 80,
        lastSeen: '2026-01-07T09:15:53Z',
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();
      expect(marker?.querySelector('text[data-hass-dash-tracking-debug="true"]')).toBeTruthy();
    });

    window.history.replaceState({}, '', '/');

    // Force effect by updating the store.
    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 4, y: 5 },
        confidence: 80,
        lastSeen: '2026-01-07T09:15:54Z',
        receivedAt: Date.now(),
      });
    });

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();
      expect(marker?.querySelector('text[data-hass-dash-tracking-debug="true"]')).toBeFalsy();
    });
  });

  it('updates the marker label when metadata changes after initial render', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const label = marker?.querySelector('text.device-label');
      expect(label?.textContent).toBe('phone_jeremy');
    });

    act(() => {
      useDeviceTrackerMetadataStore.getState().setAll({
        'device_tracker.phone_jeremy': {
          deviceId: 'abc123',
          name: 'Jeremy',
        },
      });
    });

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      const label = marker?.querySelector('text.device-label');
      expect(label?.textContent).toBe('Jeremy');
    });
  });

  it('uses data-base-viewbox for Y flipping when present', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();
    svg?.setAttribute('data-base-viewbox', '0 0 20 20');

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      // base viewBox is 0 0 20 20 so yRender = 20 - y
      expect(marker?.getAttribute('transform')).toBe('translate(1 18)');
    });
  });

  it('ignores an invalid data-base-viewbox and falls back to viewBox', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    const svg = document.getElementById('floorplan-svg');
    expect(svg).toBeTruthy();
    svg?.setAttribute('data-base-viewbox', 'nope');

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 1, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeTruthy();

      // FloorplanSvg viewBox is 0 0 10 10 so yRender = 10 - y
      expect(marker?.getAttribute('transform')).toBe('translate(1 8)');
    });
  });

  it('does not render a marker when coordinates are not finite', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: Number.NaN, y: 2 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: Date.now(),
      });
    });

    const layer = document.getElementById('devices-layer');

    await waitFor(() => {
      const marker = layer?.querySelector(
        'g[data-hass-dash-tracking="true"][data-entity-id="device_tracker.phone_jeremy"]'
      );
      expect(marker).toBeFalsy();
    });
  });
});
