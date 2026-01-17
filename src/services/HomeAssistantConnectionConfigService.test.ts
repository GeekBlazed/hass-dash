import { beforeEach, describe, expect, it } from 'vitest';

import type { IConfigService } from '../interfaces/IConfigService';
import { HomeAssistantConnectionConfigService } from './HomeAssistantConnectionConfigService';

function createConfigStub(values: Record<string, string | undefined>): IConfigService {
  return {
    getAppVersion: () => '0.1.0',
    getConfig: (key: string) => {
      const normalized = key.startsWith('VITE_') ? key : `VITE_${key}`;
      return values[normalized];
    },
  };
}

describe('HomeAssistantConnectionConfigService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('validate() reports missing token and url', () => {
    const svc = new HomeAssistantConnectionConfigService(createConfigStub({}));
    const result = svc.validate();

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/token/i);
    expect(result.errors.join(' ')).toMatch(/base url|websocket url/i);
  });

  it('getEffectiveWebSocketUrl() derives from base url when websocket url is missing', () => {
    const svc = new HomeAssistantConnectionConfigService(
      createConfigStub({
        VITE_HA_BASE_URL: 'https://example/',
        VITE_HA_ACCESS_TOKEN: 'token',
      })
    );

    expect(svc.getEffectiveWebSocketUrl()).toBe('wss://example/api/websocket');
    const validation = svc.validate();
    expect(validation.isValid).toBe(true);
    expect(validation.effectiveWebSocketUrl).toBe('wss://example/api/websocket');
  });

  it('getEffectiveWebSocketUrl() upgrades ws:// to wss:// when page is https', () => {
    const svc = new HomeAssistantConnectionConfigService(
      createConfigStub({
        VITE_HA_WEBSOCKET_URL: 'ws://example.com/api/websocket',
        VITE_HA_ACCESS_TOKEN: 'token',
      }),
      () => 'https:'
    );

    expect(svc.getEffectiveWebSocketUrl()).toBe('wss://example.com/api/websocket');

    const validation = svc.validate();
    expect(validation.effectiveWebSocketUrl).toBe('wss://example.com/api/websocket');
  });

  it('validate() rejects invalid base url scheme', () => {
    const svc = new HomeAssistantConnectionConfigService(
      createConfigStub({
        VITE_HA_BASE_URL: 'ftp://example',
        VITE_HA_ACCESS_TOKEN: 'token',
      })
    );

    const result = svc.validate();
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/http:\/\/ or https:\/\//i);
  });

  it('overrides take precedence over env config', () => {
    const svc = new HomeAssistantConnectionConfigService(
      createConfigStub({
        VITE_HA_BASE_URL: 'https://env.example',
        VITE_HA_ACCESS_TOKEN: 'env-token',
      })
    );

    svc.setOverrides({
      baseUrl: 'https://override.example/',
      accessToken: 'override-token',
    });

    const cfg = svc.getConfig();
    expect(cfg.baseUrl).toBe('https://override.example/');
    expect(cfg.accessToken).toBe('override-token');
    expect(svc.getEffectiveWebSocketUrl()).toBe('wss://override.example/api/websocket');
  });

  it('clearOverrides() removes session overrides', () => {
    const svc = new HomeAssistantConnectionConfigService(
      createConfigStub({
        VITE_HA_BASE_URL: 'https://env.example/',
        VITE_HA_ACCESS_TOKEN: 'env-token',
      })
    );

    svc.setOverrides({ baseUrl: 'https://override.example/', accessToken: 'override-token' });
    expect(svc.getConfig().baseUrl).toBe('https://override.example/');

    svc.clearOverrides();
    expect(svc.getConfig().baseUrl).toBe('https://env.example/');
  });

  it('setOverrides() trims empty strings to undefined', () => {
    const svc = new HomeAssistantConnectionConfigService(createConfigStub({}));

    svc.setOverrides({ baseUrl: '   ', webSocketUrl: '', accessToken: '\n\t' });
    const cfg = svc.getConfig();
    expect(cfg.baseUrl).toBeUndefined();
    expect(cfg.webSocketUrl).toBeUndefined();
    expect(cfg.accessToken).toBeUndefined();
  });

  it('does not crash when overrides JSON is malformed', () => {
    sessionStorage.setItem('ha_connection_overrides', 'not-json');
    const svc = new HomeAssistantConnectionConfigService(createConfigStub({}));

    expect(svc.getOverrides()).toEqual({});
  });

  // SSR behavior is covered in HomeAssistantConnectionConfigService.ssr.test.ts
});
