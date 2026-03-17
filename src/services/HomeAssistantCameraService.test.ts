import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { HaEntityId } from '../types/home-assistant';
import { HomeAssistantCameraService } from './HomeAssistantCameraService';

describe('HomeAssistantCameraService', () => {
  const connect = vi.fn().mockResolvedValue(undefined);
  const callService = vi.fn().mockResolvedValue({ context: { id: '1' }, response: {} });
  const sendCommand = vi.fn();

  const getConfig = vi.fn();
  const getEffectiveWebSocketUrl = vi.fn();
  const getAccessToken = vi.fn();

  const client = {
    connect,
    callService,
    sendCommand,
  } as unknown as IHomeAssistantClient;

  const config = {
    getConfig,
    getEffectiveWebSocketUrl,
    getAccessToken,
  } as unknown as IHomeAssistantConnectionConfig;

  const service = new HomeAssistantCameraService(client, config);

  beforeEach(() => {
    vi.clearAllMocks();
    getConfig.mockReturnValue({ baseUrl: 'http://ha.local:8123' });
    getEffectiveWebSocketUrl.mockReturnValue(undefined);
    getAccessToken.mockReturnValue('token-123');
  });

  it('turnOn and turnOff call camera domain service with normalized entity array', async () => {
    await service.turnOn('camera.front_door');
    await service.turnOff(['camera.kitchen', 'camera.office']);

    expect(connect).toHaveBeenCalledTimes(2);
    expect(callService).toHaveBeenNthCalledWith(1, {
      domain: 'camera',
      service: 'turn_on',
      service_data: { entity_id: ['camera.front_door'] },
      target: { entity_id: ['camera.front_door'] },
    });
    expect(callService).toHaveBeenNthCalledWith(2, {
      domain: 'camera',
      service: 'turn_off',
      service_data: { entity_id: ['camera.kitchen', 'camera.office'] },
      target: { entity_id: ['camera.kitchen', 'camera.office'] },
    });
  });

  it('returns null for getStreamUrl when sendCommand is unavailable', async () => {
    const noCommandClient = {
      connect,
      callService,
    } as unknown as IHomeAssistantClient;

    const noCommandService = new HomeAssistantCameraService(noCommandClient, config);

    const result = await noCommandService.getStreamUrl('camera.front_door' as HaEntityId);
    expect(result).toBeNull();
  });

  it('derives base URL from websocket URL when explicit base URL is missing', async () => {
    getConfig.mockReturnValue({ baseUrl: '' });
    getEffectiveWebSocketUrl.mockReturnValue('ws://ha.local:8123/api/websocket');
    sendCommand.mockResolvedValue('/api/stream/abc');

    const result = await service.getStreamUrl('camera.front_door' as HaEntityId);

    expect(result).toBe('http://ha.local:8123/api/stream/abc');
  });

  it('returns null when stream response has no usable URL', async () => {
    sendCommand.mockResolvedValue({ url: '   ' });

    const result = await service.getStreamUrl('camera.front_door' as HaEntityId);

    expect(result).toBeNull();
  });

  it('throws when no base URL can be resolved for stream requests', async () => {
    getConfig.mockReturnValue({ baseUrl: '   ' });
    getEffectiveWebSocketUrl.mockReturnValue('ftp://ha.local');

    await expect(service.getStreamUrl('camera.front_door' as HaEntityId)).rejects.toThrow(
      'Home Assistant base URL is not configured (VITE_HA_BASE_URL)'
    );
  });

  it('fetchProxyImage throws when token is missing', async () => {
    getAccessToken.mockReturnValue('');

    await expect(service.fetchProxyImage('camera.front_door' as HaEntityId)).rejects.toThrow(
      'Home Assistant access token is not configured (VITE_HA_ACCESS_TOKEN)'
    );
  });

  it('fetchProxyImage sends bearer auth and returns blob', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await service.fetchProxyImage('camera.front_door' as HaEntityId);

    expect(result).toBe(blob);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/camera_proxy/camera.front_door');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('fetchProxyImage includes response text in thrown error when available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('unauthorized'),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(service.fetchProxyImage('camera.front_door' as HaEntityId)).rejects.toThrow(
      /failed \(401\): unauthorized/
    );
  });
});
