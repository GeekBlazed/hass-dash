import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IConfigService } from '../interfaces/IConfigService';
import type {
  HomeAssistantConnectionConfig,
  HomeAssistantConnectionValidationResult,
  IHomeAssistantConnectionConfig,
} from '../interfaces/IHomeAssistantConnectionConfig';
import {
  deriveWebSocketUrlFromBaseUrl,
  validateHomeAssistantConnectionConfig,
} from '../utils/homeAssistantConnectionValidation';

@injectable()
export class HomeAssistantConnectionConfigService implements IHomeAssistantConnectionConfig {
  private readonly STORAGE_KEY = 'ha_connection_overrides';

  private readonly configService: IConfigService;

  constructor(@inject(TYPES.IConfigService) configService: IConfigService) {
    this.configService = configService;
  }

  getOverrides(): HomeAssistantConnectionConfig {
    if (typeof window === 'undefined') return {};

    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};

      const record = parsed as Record<string, unknown>;
      return {
        baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : undefined,
        webSocketUrl: typeof record.webSocketUrl === 'string' ? record.webSocketUrl : undefined,
        accessToken: typeof record.accessToken === 'string' ? record.accessToken : undefined,
      };
    } catch {
      return {};
    }
  }

  setOverrides(overrides: HomeAssistantConnectionConfig): void {
    if (import.meta.env.PROD) {
      console.warn('Cannot set Home Assistant connection overrides in production');
      return;
    }

    if (typeof window === 'undefined') return;

    const normalized: HomeAssistantConnectionConfig = {
      baseUrl: overrides.baseUrl?.trim() ? overrides.baseUrl.trim() : undefined,
      webSocketUrl: overrides.webSocketUrl?.trim() ? overrides.webSocketUrl.trim() : undefined,
      accessToken: overrides.accessToken?.trim() ? overrides.accessToken.trim() : undefined,
    };

    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
  }

  clearOverrides(): void {
    if (import.meta.env.PROD) {
      console.warn('Cannot clear Home Assistant connection overrides in production');
      return;
    }

    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(this.STORAGE_KEY);
  }

  getConfig(): HomeAssistantConnectionConfig {
    const overrides = this.getOverrides();

    return {
      baseUrl: overrides.baseUrl ?? this.configService.getConfig('HA_BASE_URL'),
      webSocketUrl: overrides.webSocketUrl ?? this.configService.getConfig('HA_WEBSOCKET_URL'),
      accessToken: overrides.accessToken ?? this.configService.getConfig('HA_ACCESS_TOKEN'),
    };
  }

  getEffectiveWebSocketUrl(): string | undefined {
    const config = this.getConfig();
    if (config.webSocketUrl) return this.normalizeWebSocketUrlForPageContext(config.webSocketUrl);
    if (!config.baseUrl) return undefined;

    const derived = deriveWebSocketUrlFromBaseUrl(config.baseUrl);
    return derived ? this.normalizeWebSocketUrlForPageContext(derived) : undefined;
  }

  getAccessToken(): string | undefined {
    return this.getConfig().accessToken;
  }

  validate(): HomeAssistantConnectionValidationResult {
    const result = validateHomeAssistantConnectionConfig(this.getConfig());
    if (!result.effectiveWebSocketUrl) return result;

    return {
      ...result,
      effectiveWebSocketUrl: this.normalizeWebSocketUrlForPageContext(result.effectiveWebSocketUrl),
    };
  }

  private normalizeWebSocketUrlForPageContext(value: string): string {
    const raw = value.trim();
    if (!raw) return raw;

    // Browsers block ws:// from https:// pages (mixed content). If the user
    // configured ws:// explicitly but we're running on https, attempt a safe
    // best-effort upgrade to wss://.
    const pageProtocol =
      typeof globalThis !== 'undefined' &&
      'location' in globalThis &&
      typeof (globalThis as unknown as { location?: { protocol?: unknown } }).location?.protocol ===
        'string'
        ? ((globalThis as unknown as { location: { protocol: string } }).location.protocol as
            | 'http:'
            | 'https:'
            | string)
        : undefined;

    if (pageProtocol !== 'https:') return raw;

    try {
      const url = new URL(raw);
      if (url.protocol !== 'ws:') return raw;
      url.protocol = 'wss:';
      return url.toString();
    } catch {
      return raw;
    }
  }
}
