import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import { HomeAssistantHttpClient } from './HomeAssistantHttpClient';

type ConnectionConfigStubValues = {
  baseUrl?: string;
  accessToken?: string;
};

function createConnectionConfigStub(
  values: ConnectionConfigStubValues
): IHomeAssistantConnectionConfig {
  return {
    getConfig: () => ({
      baseUrl: values.baseUrl,
      webSocketUrl: undefined,
      accessToken: values.accessToken,
    }),
    getEffectiveWebSocketUrl: () => undefined,
    getAccessToken: () => values.accessToken,
    validate: () => ({
      isValid: Boolean(values.baseUrl) && Boolean(values.accessToken),
      errors: [],
      effectiveWebSocketUrl: undefined,
    }),
    getOverrides: () => ({}),
    setOverrides: () => {},
    clearOverrides: () => {},
  };
}

describe('HomeAssistantHttpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when base URL is missing', async () => {
    const config = createConnectionConfigStub({ accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('/api/')).rejects.toThrow(
      'Home Assistant base URL is not configured (VITE_HA_BASE_URL)'
    );
  });

  it('throws when access token is missing', async () => {
    const config = createConnectionConfigStub({ baseUrl: 'http://example/' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('/api/')).rejects.toThrow(
      'Home Assistant access token is not configured (VITE_HA_ACCESS_TOKEN)'
    );
  });

  it("throws when path doesn't start with '/'", async () => {
    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('api/')).rejects.toThrow("HTTP path must start with '/': api/");
  });

  it('GET returns parsed JSON and sends Authorization header', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://example/api/');
      expect(init?.method).toBe('GET');
      expect(init?.body).toBeUndefined();

      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer token');
      expect(headers['Content-Type']).toBeUndefined();

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    const result = await client.get<{ ok: boolean }>('/api/');
    expect(result).toEqual({ ok: true });
  });

  it('POST JSON-encodes body and sets Content-Type', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');

      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer token');
      expect(headers['Content-Type']).toBe('application/json');

      expect(init?.body).toBe(JSON.stringify({ hello: 'world' }));

      return new Response(JSON.stringify({ created: true }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    const result = await client.post<{ created: boolean }>('/api/test', { hello: 'world' });
    expect(result).toEqual({ created: true });
  });

  it('returns undefined for empty successful responses', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    const result = await client.get('/api/empty');
    expect(result).toBeUndefined();
  });

  it('throws for non-OK responses and includes response text when present', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('/api/')).rejects.toThrow('failed (401): nope');
  });

  it('throws for non-OK responses even when reading response text fails', async () => {
    const fetchMock = vi.fn(async () => {
      const responseLike = {
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('read failed');
        },
      };
      return responseLike as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('/api/')).rejects.toThrow('failed (500)');
  });

  it('throws when JSON parsing fails', async () => {
    const fetchMock = vi.fn(async () => new Response('not-json', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const config = createConnectionConfigStub({ baseUrl: 'http://example/', accessToken: 'token' });
    const client = new HomeAssistantHttpClient(config);

    await expect(client.get('/api/')).rejects.toThrow('Failed to parse JSON');
  });
});
