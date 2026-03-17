import { describe, expect, it } from 'vitest';

import {
  computeInitials,
  deriveBaseUrlFromWebSocketUrl,
  resolveEntityPictureUrl,
} from './deviceLocationTracking';

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

  it('trims whitespace and strips path/query/hash from websocket URL', () => {
    expect(deriveBaseUrlFromWebSocketUrl('  ws://ha.local:8123/api/websocket?x=1#fragment  ')).toBe(
      'http://ha.local:8123/'
    );
  });
});

describe('resolveEntityPictureUrl', () => {
  it('returns undefined for empty values', () => {
    expect(resolveEntityPictureUrl('   ', 'https://ha.local')).toBeUndefined();
  });

  it('returns absolute URLs unchanged', () => {
    expect(resolveEntityPictureUrl('https://cdn.example.com/a.png', 'https://ha.local')).toBe(
      'https://cdn.example.com/a.png'
    );
    expect(resolveEntityPictureUrl('http://cdn.example.com/a.png', 'https://ha.local')).toBe(
      'http://cdn.example.com/a.png'
    );
  });

  it('returns data/blob URLs unchanged', () => {
    expect(resolveEntityPictureUrl('data:image/png;base64,abc', 'https://ha.local')).toBe(
      'data:image/png;base64,abc'
    );
    expect(resolveEntityPictureUrl('blob:https://ha.local/123', 'https://ha.local')).toBe(
      'blob:https://ha.local/123'
    );
  });

  it('resolves absolute paths with and without base URL', () => {
    expect(resolveEntityPictureUrl('/api/image.jpg', undefined)).toBe('/api/image.jpg');
    expect(resolveEntityPictureUrl('/api/image.jpg', 'https://ha.local')).toBe(
      'https://ha.local/api/image.jpg'
    );
  });

  it('returns non-prefixed values as-is', () => {
    expect(resolveEntityPictureUrl('images/avatar.png', 'https://ha.local')).toBe(
      'images/avatar.png'
    );
  });
});

describe('computeInitials', () => {
  it('returns undefined for empty names', () => {
    expect(computeInitials('')).toBeUndefined();
    expect(computeInitials('   ')).toBeUndefined();
  });

  it('uses first and last words for initials', () => {
    expect(computeInitials('Jane Doe')).toBe('JD');
    expect(computeInitials('  Mary   Jane   Watson  ')).toBe('MW');
  });

  it('uses one-letter initial for single-word names', () => {
    expect(computeInitials('Plato')).toBe('P');
  });

  it('uppercases initials and handles punctuation', () => {
    expect(computeInitials('jane d.')).toBe('JD');
  });
});
