import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';
import { FloorplanSvg } from './FloorplanSvg';
import { TrackedDeviceMarkersBridge } from './TrackedDeviceMarkersBridge';

describe('TrackedDeviceMarkersBridge', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'true');
    useDeviceLocationStore.persist.clearStorage();
    useDeviceLocationStore.setState({ locationsByEntityId: {} });
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
        receivedAt: 123,
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
        receivedAt: 1,
      });
    });

    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 9, y: 8 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: 2,
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

  it('binds to an existing prototype marker and restores on disable', async () => {
    render(
      <>
        <FloorplanSvg />
        <TrackedDeviceMarkersBridge />
      </>
    );

    const layer = document.getElementById('devices-layer');
    expect(layer).toBeTruthy();

    // Simulate scripts.js marker
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
        receivedAt: 1,
      });
    });

    await waitFor(() => {
      // viewBox 0 0 10 10 -> yRender = 10 - 2 = 8
      expect(existing.getAttribute('transform')).toBe('translate(1 8)');
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe('true');
    });

    vi.stubEnv('VITE_FEATURE_DEVICE_TRACKING', 'false');

    // Force re-render by updating store (bridge effect depends on state + flag)
    act(() => {
      useDeviceLocationStore.getState().upsert('device_tracker.phone_jeremy', {
        position: { x: 4, y: 5 },
        confidence: 80,
        lastSeen: undefined,
        receivedAt: 2,
      });
    });

    await waitFor(() => {
      expect(existing.getAttribute('data-hass-dash-tracking')).toBe(null);
      expect(existing.getAttribute('transform')).toBe('translate(2 3)');
    });
  });
});
