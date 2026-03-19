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

type StreamCandidate = {
  url: string;
  score: number;
};

const HD_KEYWORDS = ['hd', 'high', 'fullhd', '1080', '2k', '4k', '2160'];
const SD_KEYWORDS = ['sd', 'low', 'substream', '640', '480', '360'];

const scoreLabel = (label: string): number => {
  const normalized = label.toLowerCase();
  let score = 0;

  if (HD_KEYWORDS.some((k) => normalized.includes(k))) score += 10;
  if (SD_KEYWORDS.some((k) => normalized.includes(k))) score -= 10;

  return score;
};

const collectStreamCandidates = (value: unknown): StreamCandidate[] => {
  const candidates: StreamCandidate[] = [];

  const add = (url: unknown, ...labels: unknown[]) => {
    if (typeof url !== 'string' || url.trim().length === 0) return;

    const score = labels
      .filter((v): v is string => typeof v === 'string')
      .map((s) => scoreLabel(s))
      .reduce((acc, next) => acc + next, 0);

    candidates.push({ url: url.trim(), score });
  };

  if (typeof value === 'string') {
    add(value);
    return candidates;
  }

  if (!value || typeof value !== 'object') {
    return candidates;
  }

  const obj = value as Record<string, unknown>;

  add(obj.url, obj.quality, obj.stream, obj.name, obj.title, obj.profile);
  add(obj.hd_url, 'hd');
  add(obj.high_url, 'high');
  add(obj.sd_url, 'sd');
  add(obj.low_url, 'low');

  const nestedStreams = obj.streams;
  if (Array.isArray(nestedStreams)) {
    for (const entry of nestedStreams) {
      if (!entry || typeof entry !== 'object') continue;
      const stream = entry as Record<string, unknown>;
      add(stream.url, stream.quality, stream.stream, stream.name, stream.title, stream.profile);
    }
  }

  return candidates;
};

const selectPreferredStreamUrl = (value: unknown): string | null => {
  const candidates = collectStreamCandidates(value);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
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

    const streamUrl = selectPreferredStreamUrl(result);
    if (!streamUrl) return null;

    const absolute = new URL(streamUrl, baseUrl);
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
