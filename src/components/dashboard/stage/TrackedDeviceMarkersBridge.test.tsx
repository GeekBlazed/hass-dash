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
      expect(marker?.getAttribute('transform')).toBe('translate(1 2)');
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
      expect(marker?.getAttribute('transform')).toBe('translate(9 8)');
    });
  });
});
