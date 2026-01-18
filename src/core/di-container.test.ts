import { Container } from 'inversify';
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { IConfigService } from '../interfaces/IConfigService';
import { ConfigService } from '../services/ConfigService';
import { TYPES } from './types';

describe('DI Container', () => {
  it('should create a new container', () => {
    const container = new Container();
    expect(container).toBeDefined();
  });

  it('should bind and resolve IConfigService', () => {
    const container = new Container();
    container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService);

    const configService = container.get<IConfigService>(TYPES.IConfigService);

    expect(configService).toBeDefined();
    expect(configService).toBeInstanceOf(ConfigService);
  });

  it('should return singleton instance when bound with inSingletonScope', () => {
    const container = new Container();
    container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService).inSingletonScope();

    const instance1 = container.get<IConfigService>(TYPES.IConfigService);
    const instance2 = container.get<IConfigService>(TYPES.IConfigService);

    expect(instance1).toBe(instance2);
  });

  it('should implement IConfigService interface correctly', () => {
    const container = new Container();
    container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService);

    const configService = container.get<IConfigService>(TYPES.IConfigService);

    expect(typeof configService.getAppVersion).toBe('function');
    expect(typeof configService.getConfig).toBe('function');
  });

  it('should resolve service with working methods', () => {
    vi.stubEnv('VITE_APP_VERSION', '0.1.0');

    const container = new Container();
    container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService);

    const configService = container.get<IConfigService>(TYPES.IConfigService);

    const version = configService.getAppVersion();
    expect(version).toBeDefined();
    expect(typeof version).toBe('string');

    const config = configService.getConfig('APP_VERSION');
    expect(config).toBeDefined();

    vi.unstubAllEnvs();
  });
});
