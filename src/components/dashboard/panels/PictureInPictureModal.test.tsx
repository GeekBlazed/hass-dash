import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { container } from '../../../core/di-container';
import { TYPES } from '../../../core/types';
import type { ICameraService } from '../../../interfaces/ICameraService';
import type { IHomeAssistantConnectionConfig } from '../../../interfaces/IHomeAssistantConnectionConfig';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';
import { PictureInPictureModal } from './PictureInPictureModal';

const makeCameraEntity = (
  entityId: string,
  friendlyName: string,
  entityPicture?: string
): HaEntityState => ({
  entity_id: entityId,
  state: 'idle',
  attributes: {
    friendly_name: friendlyName,
    ...(entityPicture ? { entity_picture: entityPicture } : {}),
  },
  last_changed: '2026-01-01T00:00:00Z',
  last_updated: '2026-01-01T00:00:00Z',
  context: { id: 'ctx', parent_id: null, user_id: null },
});

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

describe('PictureInPictureModal', () => {
  beforeEach(() => {
    useEntityStore.getState().clear();
    useDashboardStore.setState({
      stageMediaStreamUrl: 'http://stream1.tv:8889/hdmi/',
    });
    vi.restoreAllMocks();
  });

  it('renders a camera stream in picture-in-picture container', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.kitchen', 'Kitchen', '/api/camera_proxy/camera.kitchen?token=abc')
      );

    const getStreamUrl = vi
      .fn<NonNullable<ICameraService['getStreamUrl']>>()
      .mockResolvedValue('http://stream.example/kitchen.mjpeg');

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl,
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.kitchen" open={true} onOpenChange={() => undefined} />
    );

    const stream = await screen.findByRole('img', { name: 'Live stream from Kitchen' });
    expect(stream).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('swaps the current PiP stream with stage stream source', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.kitchen', 'Kitchen', '/api/camera_proxy/camera.kitchen?token=abc')
      );

    const getStreamUrl = vi
      .fn<NonNullable<ICameraService['getStreamUrl']>>()
      .mockResolvedValue('http://stream.example/kitchen.mjpeg');

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl,
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.kitchen" open={true} onOpenChange={() => undefined} />
    );

    await screen.findByRole('img', { name: 'Live stream from Kitchen' });

    fireEvent.click(screen.getByRole('button', { name: 'Swap Stage' }));

    expect(useDashboardStore.getState().stageMediaStreamUrl).toBe(
      'http://stream.example/kitchen.mjpeg'
    );

    const frame = screen.getByTitle('Picture-in-picture feed for Kitchen');
    expect(frame).toHaveAttribute('src', 'http://stream1.tv:8889/hdmi/');
  });
});
