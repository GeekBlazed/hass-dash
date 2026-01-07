import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IConfigService } from '../interfaces/IConfigService';
import type {
  HomeAssistantConnectionConfig,
  HomeAssistantConnectionValidationResult,
  IHomeAssistantConnectionConfig,
} from '../interfaces/IHomeAssistantConnectionConfig';

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
    if (config.webSocketUrl) return config.webSocketUrl;
    if (!config.baseUrl) return undefined;

    return this.deriveWebSocketUrlFromBaseUrl(config.baseUrl);
  }

  getAccessToken(): string | undefined {
    return this.getConfig().accessToken;
  }

  validate(): HomeAssistantConnectionValidationResult {
    const config = this.getConfig();
    const errors: string[] = [];

    const hasToken = Boolean(config.accessToken?.trim());
    if (!hasToken) {
      errors.push('Access token is required.');
    }

    const baseUrl = config.baseUrl?.trim();
    const wsUrl = config.webSocketUrl?.trim();

    let effectiveWebSocketUrl: string | undefined;

    if (wsUrl) {
      const wsValid = this.isValidUrlWithProtocol(wsUrl, ['ws:', 'wss:']);
      if (!wsValid) {
        errors.push('WebSocket URL must start with ws:// or wss:// and be a valid URL.');
      } else {
        effectiveWebSocketUrl = wsUrl;
      }
    } else if (baseUrl) {
      const baseValid = this.isValidUrlWithProtocol(baseUrl, ['http:', 'https:']);
      if (!baseValid) {
        errors.push('Base URL must start with http:// or https:// and be a valid URL.');
      } else {
        effectiveWebSocketUrl = this.deriveWebSocketUrlFromBaseUrl(baseUrl);
        if (!effectiveWebSocketUrl) {
          errors.push('Could not derive WebSocket URL from Base URL.');
        }
      }
    } else {
      errors.push('Base URL or WebSocket URL is required.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      effectiveWebSocketUrl,
    };
  }

  private deriveWebSocketUrlFromBaseUrl(baseUrl: string): string | undefined {
    const trimmed = baseUrl.trim();
    if (trimmed.startsWith('https://')) {
      return `${trimmed.replace('https://', 'wss://').replace(/\/$/, '')}/api/websocket`;
    }

    if (trimmed.startsWith('http://')) {
      return `${trimmed.replace('http://', 'ws://').replace(/\/$/, '')}/api/websocket`;
    }

    return undefined;
  }

  private isValidUrlWithProtocol(
    value: string,
    allowedProtocols: Array<'http:' | 'https:' | 'ws:' | 'wss:'>
  ): boolean {
    try {
      const url = new URL(value);
      return allowedProtocols.includes(url.protocol as (typeof allowedProtocols)[number]);
    } catch {
      return false;
    }
  }
}
