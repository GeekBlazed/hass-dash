import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IHttpClient } from '../interfaces/IHttpClient';

@injectable()
export class HomeAssistantHttpClient implements IHttpClient {
  private readonly connectionConfig: IHomeAssistantConnectionConfig;

  constructor(
    @inject(TYPES.IHomeAssistantConnectionConfig)
    connectionConfig: IHomeAssistantConnectionConfig
  ) {
    this.connectionConfig = connectionConfig;
  }

  async get<TResponse>(path: string): Promise<TResponse | undefined> {
    return this.request<TResponse>('GET', path);
  }

  async post<TResponse>(path: string, body?: unknown): Promise<TResponse | undefined> {
    return this.request<TResponse>('POST', path, body);
  }

  private async request<TResponse>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<TResponse | undefined> {
    const baseUrl = this.getBaseUrl();
    const token = this.connectionConfig.getAccessToken();

    if (!baseUrl) {
      throw new Error('Home Assistant base URL is not configured (VITE_HA_BASE_URL)');
    }

    if (!token) {
      throw new Error('Home Assistant access token is not configured (VITE_HA_ACCESS_TOKEN)');
    }

    if (!path.startsWith('/')) {
      throw new Error(`HTTP path must start with '/': ${path}`);
    }

    const url = new URL(path, baseUrl);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let requestBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      let message = `${method} ${url.toString()} failed (${response.status})`;
      try {
        const text = await response.text();
        if (text.trim()) {
          message = `${message}: ${text}`;
        }
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    // /api/ returns JSON, but some endpoints can return empty responses.
    const text = await response.text();
    if (!text.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(text) as TResponse;
    } catch {
      throw new Error(`Failed to parse JSON from ${method} ${url.toString()}`);
    }
  }

  private getBaseUrl(): string | undefined {
    const cfg = this.connectionConfig.getConfig();
    const baseUrl = cfg.baseUrl?.trim();
    return baseUrl ? baseUrl : undefined;
  }
}
