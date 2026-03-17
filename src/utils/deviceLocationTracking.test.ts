import { describe, expect, it } from 'vitest';

import { deriveBaseUrlFromWebSocketUrl } from './deviceLocationTracking';

describe('deriveBaseUrlFromWebSocketUrl', () => {
  it('returns normalized base URL for valid ws/wss URLs', () => {
    expect(deriveBaseUrlFromWebSocketUrl('ws://ha.local:8123/api/websocket')).toBe(
      'http://ha.local:8123/'
    );
    expect(deriveBaseUrlFromWebSocketUrl('wss://ha.example.com/api/websocket')).toBe(
      'https://ha.example.com/'
    );
  });

  it('returns undefined for invalid protocols', () => {
    expect(deriveBaseUrlFromWebSocketUrl('http://ha.local:8123/api/websocket')).toBeUndefined();
    expect(deriveBaseUrlFromWebSocketUrl('ftp://ha.local:8123/api/websocket')).toBeUndefined();
  });

  it('returns undefined for malformed URLs', () => {
    expect(deriveBaseUrlFromWebSocketUrl('not-a-url')).toBeUndefined();
    expect(deriveBaseUrlFromWebSocketUrl('')).toBeUndefined();
  });
});
