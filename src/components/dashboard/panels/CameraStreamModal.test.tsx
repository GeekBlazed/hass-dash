import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import { TYPES } from '../../../core/types';
import type { ICameraService } from '../../../interfaces/ICameraService';
import type { IHomeAssistantConnectionConfig } from '../../../interfaces/IHomeAssistantConnectionConfig';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { CameraStreamModal } from './CameraStreamModal';

const TEST_TIMESTAMP = '2026-01-01T00:00:00Z';

const makeCameraEntity = (
  entityId: string,
  friendlyName: string,
  entityPicture?: string
): HaEntityState => {
  const attributes: Record<string, unknown> = {
    friendly_name: friendlyName,
  };

  if (entityPicture) {
    attributes.entity_picture = entityPicture;
  }

  return {
    entity_id: entityId,
    state: 'idle',
    attributes,
    last_changed: TEST_TIMESTAMP,
    last_updated: TEST_TIMESTAMP,
    context: { id: 'ctx', parent_id: null, user_id: null },
  };
};

const makeConnectionConfig = (): IHomeAssistantConnectionConfig => ({
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
});

const mockContainerServices = (mockService: ICameraService): void => {
  vi.spyOn(container, 'get').mockImplementation((serviceId: unknown) => {
    if (serviceId === TYPES.ICameraService) return mockService;
    if (serviceId === TYPES.IHomeAssistantConnectionConfig) return makeConnectionConfig();
    throw new Error(`Unexpected service lookup in test: ${String(serviceId)}`);
  });
};

describe('CameraStreamModal', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    vi.restoreAllMocks();
  });

  it('prefers entity_picture proxy stream URL and skips getStreamUrl', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.kitchen', 'Kitchen', '/api/camera_proxy/camera.kitchen?token=abc')
      );

    const getStreamUrl = vi
      .fn<NonNullable<ICameraService['getStreamUrl']>>()
      .mockResolvedValue('http://stream.example/fallback.mjpeg');

    const mockService: ICameraService = {
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl,
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    };

    mockContainerServices(mockService);

    render(
      <CameraStreamModal entityId="camera.kitchen" open={true} onOpenChange={() => undefined} />
    );

    const stream = await screen.findByRole('img', { name: 'Live stream from Kitchen' });
    expect(stream.getAttribute('src')).toBe(
      'http://ha.example:8123/api/camera_proxy_stream/camera.kitchen?token=abc'
    );
    expect(getStreamUrl).not.toHaveBeenCalled();
  });

  it('falls back to camera service stream URL when entity_picture is unavailable', async () => {
    useEntityStore.getState().upsert(makeCameraEntity('camera.office', 'Office'));

    const getStreamUrl = vi
      .fn<NonNullable<ICameraService['getStreamUrl']>>()
      .mockResolvedValue('http://stream.example/camera.office.mjpeg');

    const mockService: ICameraService = {
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl,
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    };

    mockContainerServices(mockService);

    render(
      <CameraStreamModal entityId="camera.office" open={true} onOpenChange={() => undefined} />
    );

    const stream = await screen.findByRole('img', { name: 'Live stream from Office' });
    expect(stream.getAttribute('src')).toBe('http://stream.example/camera.office.mjpeg');
    expect(getStreamUrl).toHaveBeenCalledWith('camera.office');
  });

  it('shows a readable error when the stream URL request fails', async () => {
    useEntityStore.getState().upsert(makeCameraEntity('camera.garage', 'Garage'));

    const mockService: ICameraService = {
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockRejectedValue(new Error('Boom')),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    };

    mockContainerServices(mockService);

    render(
      <CameraStreamModal entityId="camera.garage" open={true} onOpenChange={() => undefined} />
    );

    await screen.findByText('Boom');
  });
});
