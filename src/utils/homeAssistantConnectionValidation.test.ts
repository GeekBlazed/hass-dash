import { describe, expect, it } from 'vitest';

import {
  deriveWebSocketUrlFromBaseUrl,
  validateHomeAssistantConnectionConfig,
} from './homeAssistantConnectionValidation';

describe('homeAssistantConnectionValidation', () => {
  describe('deriveWebSocketUrlFromBaseUrl', () => {
    it('derives wss:// URL from https:// baseUrl and normalizes path', () => {
      expect(deriveWebSocketUrlFromBaseUrl(' https://example.com/ ')).toBe(
        'wss://example.com/api/websocket'
      );
    });

    it('derives ws:// URL from http:// baseUrl', () => {
      expect(deriveWebSocketUrlFromBaseUrl('http://example.com')).toBe(
        'ws://example.com/api/websocket'
      );
    });

    it('returns undefined for unsupported protocols', () => {
      expect(deriveWebSocketUrlFromBaseUrl('ftp://example.com')).toBeUndefined();
    });

    it('returns undefined for invalid URLs', () => {
      expect(deriveWebSocketUrlFromBaseUrl('not a url')).toBeUndefined();
    });
  });

  describe('validateHomeAssistantConnectionConfig', () => {
    it('requires access token and either baseUrl or webSocketUrl', () => {
      const result = validateHomeAssistantConnectionConfig({});
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Access token is required.');
      expect(result.errors).toContain('Base URL or WebSocket URL is required.');
      expect(result.effectiveWebSocketUrl).toBeUndefined();
    });

    it('validates explicit webSocketUrl when provided', () => {
      const bad = validateHomeAssistantConnectionConfig({
        accessToken: 'token',
        webSocketUrl: 'http://example.com/api/websocket',
      });
      expect(bad.isValid).toBe(false);
      expect(bad.errors).toContain(
        'WebSocket URL must start with ws:// or wss:// and be a valid URL.'
      );

      const good = validateHomeAssistantConnectionConfig({
        accessToken: ' token ',
        webSocketUrl: ' ws://example.com/api/websocket ',
      });
      expect(good.isValid).toBe(true);
      expect(good.errors).toEqual([]);
      expect(good.effectiveWebSocketUrl).toBe('ws://example.com/api/websocket');
    });

    it('derives effectiveWebSocketUrl from baseUrl when webSocketUrl is absent', () => {
      const result = validateHomeAssistantConnectionConfig({
        accessToken: 'token',
        baseUrl: 'https://example.com',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.effectiveWebSocketUrl).toBe('wss://example.com/api/websocket');
    });

    it('reports baseUrl protocol errors', () => {
      const result = validateHomeAssistantConnectionConfig({
        accessToken: 'token',
        baseUrl: 'ws://example.com',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Base URL must start with http:// or https:// and be a valid URL.'
      );
      expect(result.effectiveWebSocketUrl).toBeUndefined();
    });
  });
});
