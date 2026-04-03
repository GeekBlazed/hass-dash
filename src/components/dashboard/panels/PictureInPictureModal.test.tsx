import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('updates pip size when viewport is resized', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.kitchen', 'Kitchen', '/api/camera_proxy/camera.kitchen?token=abc')
      );

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/kitchen.mjpeg'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    render(
      <PictureInPictureModal entityId="camera.kitchen" open={true} onOpenChange={() => undefined} />
    );

    await screen.findByRole('img', { name: 'Live stream from Kitchen' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ width: '280px', height: '180px' });

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 2200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1400 });
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(dialog).toHaveStyle({ width: '440px', height: '280px' });
    });

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
  });

  it('renders nothing when closed', () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.kitchen', 'Kitchen', '/api/camera_proxy/camera.kitchen?token=abc')
      );

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/kitchen.mjpeg'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal
        entityId="camera.kitchen"
        open={false}
        onOpenChange={() => undefined}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  it('calls onOpenChange(false) when the close button is clicked', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.office', 'Office', '/api/camera_proxy/camera.office?token=abc')
      );

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/office.mjpeg'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    const onOpenChange = vi.fn();

    render(
      <PictureInPictureModal entityId="camera.office" open={true} onOpenChange={onOpenChange} />
    );

    await screen.findByRole('img', { name: 'Live stream from Office' });

    fireEvent.click(screen.getByRole('button', { name: 'Close picture in picture' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders an iframe for embedded stream URLs', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity('camera.front', 'Front Door', '/api/camera_proxy/camera.front?token=abc')
      );

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream1.tv:8889/hdmi/'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.front" open={true} onOpenChange={() => undefined} />
    );

    const frame = await screen.findByTitle('Picture-in-picture feed for Front Door');
    expect(frame).toHaveAttribute('src', 'http://stream1.tv:8889/hdmi/');
  });

  it('sets stage stream when swapping while stage is empty', async () => {
    useDashboardStore.setState({ stageMediaStreamUrl: null });
    useEntityStore
      .getState()
      .upsert(makeCameraEntity('camera.den', 'Den', '/api/camera_proxy/camera.den?token=abc'));

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/den.mjpeg'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.den" open={true} onOpenChange={() => undefined} />
    );

    await screen.findByRole('img', { name: 'Live stream from Den' });

    fireEvent.click(screen.getByRole('button', { name: 'Swap Stage' }));

    expect(useDashboardStore.getState().stageMediaStreamUrl).toBe(
      'http://stream.example/den.mjpeg'
    );
    expect(screen.queryByTitle('Picture-in-picture feed for Den')).not.toBeInTheDocument();
  });

  it('falls back to entity-picture stream when preferred video stalls', async () => {
    useEntityStore
      .getState()
      .upsert(
        makeCameraEntity(
          'camera.driveway',
          'Driveway',
          '/api/camera_proxy/camera.driveway?token=abc'
        )
      );

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/driveway.mp4'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal
        entityId="camera.driveway"
        open={true}
        onOpenChange={() => undefined}
      />
    );

    await waitFor(() => {
      expect(document.querySelector('.pip-modal video')).not.toBeNull();
    });

    fireEvent.stalled(document.querySelector('.pip-modal video') as HTMLVideoElement);

    const stream = await screen.findByRole('img', { name: 'Live stream from Driveway' });
    expect(stream.getAttribute('src')).toBe(
      'http://ha.example:8123/api/camera_proxy_stream/camera.driveway?token=abc'
    );
  });

  it('shows stream load error when no stream source is available', async () => {
    useEntityStore.getState().upsert(makeCameraEntity('camera.gate', 'Gate'));

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockRejectedValue(new Error('Failed to load camera stream')),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.gate" open={true} onOpenChange={() => undefined} />
    );

    expect(await screen.findByText('Failed to load camera stream')).toBeInTheDocument();
  });

  it('shows unplayable message when HLS stream has no fallback', async () => {
    useEntityStore.getState().upsert(makeCameraEntity('camera.loft', 'Loft'));

    mockContainerServices({
      turnOn: vi.fn().mockResolvedValue(undefined),
      turnOff: vi.fn().mockResolvedValue(undefined),
      getStreamUrl: vi
        .fn<NonNullable<ICameraService['getStreamUrl']>>()
        .mockResolvedValue('http://stream.example/loft_hd.m3u8'),
      fetchProxyImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })),
    });

    render(
      <PictureInPictureModal entityId="camera.loft" open={true} onOpenChange={() => undefined} />
    );

    expect(
      await screen.findByText('Stream URL is not playable by this browser.')
    ).toBeInTheDocument();
  });
});
