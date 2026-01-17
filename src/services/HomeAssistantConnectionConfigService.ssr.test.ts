// @vitest-environment node

import { describe, expect, it } from 'vitest';

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

describe('HomeAssistantConnectionConfigService (SSR)', () => {
  it('getOverrides() returns empty object when window is undefined', () => {
    const svc = new HomeAssistantConnectionConfigService(createConfigStub({}));
    expect(svc.getOverrides()).toEqual({});
  });
});
