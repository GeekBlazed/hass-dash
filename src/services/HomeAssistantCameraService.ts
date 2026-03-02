import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { ICameraService } from '../interfaces/ICameraService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { HaEntityId } from '../types/home-assistant';

const deriveBaseUrlFromWebSocketUrl = (webSocketUrl: string): string | undefined => {
  try {
    const url = new URL(webSocketUrl.trim());

    // Map ws/wss -> http/https.
    if (url.protocol === 'ws:') url.protocol = 'http:';
    else if (url.protocol === 'wss:') url.protocol = 'https:';
    else return undefined;

    url.pathname = '/';
    url.search = '';
    url.hash = '';

    return url.toString();
  } catch {
    return undefined;
  }
};

@injectable()
export class HomeAssistantCameraService implements ICameraService {
  constructor(
    @inject(TYPES.IHomeAssistantClient)
    private readonly homeAssistantClient: IHomeAssistantClient,
    @inject(TYPES.IHomeAssistantConnectionConfig)
    private readonly connectionConfig: IHomeAssistantConnectionConfig
  ) {}

  private getCameraProxyPath(entityId: HaEntityId): string {
    return `/api/camera_proxy/${encodeURIComponent(entityId)}`;
  }

  async turnOn(entityIds: string | string[]): Promise<void> {
    await this.callCameraService('turn_on', entityIds as HaEntityId | HaEntityId[]);
  }

  async turnOff(entityIds: string | string[]): Promise<void> {
    await this.callCameraService('turn_off', entityIds as HaEntityId | HaEntityId[]);
  }

  async getStreamUrl(entityId: HaEntityId): Promise<string | null> {
    await this.homeAssistantClient.connect();

    if (!this.homeAssistantClient.sendCommand) {
      return null;
    }

    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      throw new Error('Home Assistant base URL is not configured (VITE_HA_BASE_URL)');
    }

    const result = await this.homeAssistantClient.sendCommand({
      type: 'camera/stream',
      entity_id: entityId,
    });

    let streamUrl: string | undefined;
    if (typeof result === 'string') {
      streamUrl = result;
    } else if (typeof result === 'object' && result !== null) {
      const candidate = (result as { url?: unknown }).url;
      if (typeof candidate === 'string') streamUrl = candidate;
    }

    if (!streamUrl?.trim()) return null;

    const absolute = new URL(streamUrl, baseUrl);

    // In dev, prefer same-origin paths so the Vite proxy can forward `/api/*`
    // to Home Assistant without triggering browser CORS.
    if (import.meta.env.DEV) {
      return `${absolute.pathname}${absolute.search}${absolute.hash}`;
    }

    return absolute.toString();
  }

  async fetchProxyImage(entityId: HaEntityId): Promise<Blob> {
    const baseUrl = this.getBaseUrl();
    const token = this.connectionConfig.getAccessToken();

    if (!baseUrl) {
      throw new Error('Home Assistant base URL is not configured (VITE_HA_BASE_URL)');
    }

    if (!token) {
      throw new Error('Home Assistant access token is not configured (VITE_HA_ACCESS_TOKEN)');
    }

    const path = this.getCameraProxyPath(entityId);
    // In dev, fetch from same-origin `/api/...` and rely on Vite's dev proxy.
    const url = import.meta.env.DEV
      ? new URL(path, window.location.origin)
      : new URL(path, baseUrl);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let message = `GET ${url.toString()} failed (${response.status})`;
      try {
        const text = await response.text();
        if (text.trim()) message = `${message}: ${text}`;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response.blob();
  }

  private async callCameraService(
    service: 'turn_on' | 'turn_off',
    entityIds: HaEntityId | HaEntityId[],
    serviceData?: Record<string, unknown>
  ): Promise<void> {
    const targetEntityIds = Array.isArray(entityIds) ? entityIds : [entityIds];

    await this.homeAssistantClient.connect();
    await this.homeAssistantClient.callService({
      domain: 'camera',
      service,
      service_data: {
        entity_id: targetEntityIds,
        ...(serviceData ?? {}),
      },
      target: {
        entity_id: targetEntityIds,
      },
    });
  }

  private getBaseUrl(): string | undefined {
    const cfg = this.connectionConfig.getConfig();
    const baseUrl = cfg.baseUrl?.trim();
    if (baseUrl) return baseUrl;

    const wsUrl = cfg.webSocketUrl?.trim() || this.connectionConfig.getEffectiveWebSocketUrl();
    if (!wsUrl) return undefined;

    return deriveBaseUrlFromWebSocketUrl(wsUrl);
  }
}
