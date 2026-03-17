import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import { TYPES } from '../../../core/types';
import type { ICameraService } from '../../../interfaces/ICameraService';
import type { IHomeAssistantConnectionConfig } from '../../../interfaces/IHomeAssistantConnectionConfig';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { CamerasPanel } from './CamerasPanel';

const makeCamera = (entityId: string, state: string, friendlyName?: string): HaEntityState => {
  const attrs: Record<string, unknown> = {};
  if (friendlyName !== undefined) attrs.friendly_name = friendlyName;

  return {
    entity_id: entityId,
    state,
    attributes: attrs,
    last_changed: '2026-01-01T00:00:00Z',
    last_updated: '2026-01-01T00:00:00Z',
    context: { id: 'c', parent_id: null, user_id: null },
  };
};

describe('CamerasPanel', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    vi.restoreAllMocks();
  });

  it('shows empty state when there are no cameras', () => {
    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('There are no cameras.')).not.toBeNull();
    const empty = document.getElementById('cameras-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(false);
  });

  it('applies the hidden class when isHidden is true', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));

    render(<CamerasPanel isHidden={true} />);

    const panel = document.getElementById('cameras-panel');
    expect(panel?.classList.contains('is-hidden')).toBe(true);
  });

  it('renders cameras and sorts by display name', () => {
    useEntityStore.getState().upsert(makeCamera('camera.front_porch', 'idle', 'B Porch'));
    useEntityStore.getState().upsert(makeCamera('camera.garage', 'streaming', 'A Garage'));

    render(<CamerasPanel isHidden={false} />);

    const items = document.querySelectorAll('#cameras-list .cameras-item');
    expect(items.length).toBe(2);

    expect(items[0]?.textContent).toContain('A Garage');
    expect(items[1]?.textContent).toContain('B Porch');

    // State is included in the meta line.
    expect(items[0]?.textContent).toContain('streaming');

    const empty = document.getElementById('cameras-empty');
    expect(empty?.classList.contains('is-hidden')).toBe(true);
  });

  it('filters to household-labeled cameras when household ids exist', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));
    useEntityStore.getState().upsert(makeCamera('camera.garage', 'idle', 'Garage'));

    useEntityStore.getState().setHassDashEntityIds(['camera.kitchen']);

    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('Kitchen')).not.toBeNull();
    expect(screen.queryByText('Garage')).toBeNull();
  });

  it("explains when cameras exist but none match the 'hass-dash' label", () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));
    useEntityStore.getState().setHassDashEntityIds(['light.kitchen']);

    render(<CamerasPanel isHidden={false} />);

    expect(
      screen.queryByText(
        "No cameras match the 'hass-dash' label. Add the label to a camera entity or its device in Home Assistant."
      )
    ).not.toBeNull();
  });

  it('falls back to attributes.name when friendly_name is empty', () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', '   '));

    useEntityStore.getState().upsert({
      ...makeCamera('camera.kitchen', 'idle'),
      attributes: { name: 'Kitchen Camera' },
    });

    render(<CamerasPanel isHidden={false} />);

    expect(screen.queryByText('Kitchen Camera')).not.toBeNull();
  });

  it('opens details and fetches a snapshot when a camera is selected', async () => {
    useEntityStore.getState().upsert(makeCamera('camera.kitchen', 'idle', 'Kitchen'));

    const getStreamUrl = vi
      .fn<NonNullable<ICameraService['getStreamUrl']>>()
      .mockResolvedValue('http://example.test/stream.mjpeg');

    const fetchProxyImage = vi
      .fn<ICameraService['fetchProxyImage']>()
      .mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));

    const mockService: ICameraService = {
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl,
      fetchProxyImage,
    };

    const mockConnectionConfig: IHomeAssistantConnectionConfig = {
      getConfig: () => ({
        baseUrl: 'http://ha.example:8123',
        webSocketUrl: 'ws://ha.example:8123/api/websocket',
        accessToken: 'token',
      }),
      getEffectiveWebSocketUrl: () => 'ws://ha.example:8123/api/websocket',
      getAccessToken: () => 'token',
      validate: () => ({
        isValid: true,
        errors: [],
        effectiveWebSocketUrl: 'ws://ha.example:8123/api/websocket',
      }),
      getOverrides: () => ({}),
      setOverrides: () => {},
      clearOverrides: () => {},
    };

    const getSpy = vi.spyOn(container, 'get').mockImplementation((serviceId: unknown) => {
      if (serviceId === TYPES.ICameraService) return mockService;
      if (serviceId === TYPES.IHomeAssistantConnectionConfig) return mockConnectionConfig;
      throw new Error(`Unexpected service lookup in test: ${String(serviceId)}`);
    });

    render(<CamerasPanel isHidden={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open live view for Kitchen' }));

    await screen.findByRole('dialog');
    await screen.findByRole('img', { name: 'Live stream from Kitchen' });
    expect(getStreamUrl).toHaveBeenCalledWith('camera.kitchen');

    getSpy.mockRestore();
  });
});
