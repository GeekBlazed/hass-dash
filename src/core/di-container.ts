import { Container } from 'inversify';
import 'reflect-metadata';
import type { IClimateDataSource } from '../interfaces/IClimateDataSource';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IDeviceTrackerMetadataService } from '../interfaces/IDeviceTrackerMetadataService';
import type { IEntityService } from '../interfaces/IEntityService';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';
import type { IFloorplanDataSource } from '../interfaces/IFloorplanDataSource';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantConnectionConfig } from '../interfaces/IHomeAssistantConnectionConfig';
import type { IHttpClient } from '../interfaces/IHttpClient';
import type { ILightingDataSource } from '../interfaces/ILightingDataSource';
import type { IWebSocketService } from '../interfaces/IWebSocketService';
import { ConfigService } from '../services/ConfigService';
import { FeatureFlagService } from '../services/FeatureFlagService';
import { HomeAssistantConnectionConfigService } from '../services/HomeAssistantConnectionConfigService';
import { HomeAssistantDeviceTrackerMetadataService } from '../services/HomeAssistantDeviceTrackerMetadataService';
import { HomeAssistantEntityService } from '../services/HomeAssistantEntityService';
import { HomeAssistantHttpClient } from '../services/HomeAssistantHttpClient';
import { HomeAssistantWebSocketClient } from '../services/HomeAssistantWebSocketClient';
import { HomeAssistantWebSocketService } from '../services/HomeAssistantWebSocketService';
import { PublicClimateYamlDataSource } from '../services/PublicClimateYamlDataSource';
import { PublicFloorplanYamlDataSource } from '../services/PublicFloorplanYamlDataSource';
import { PublicLightingYamlDataSource } from '../services/PublicLightingYamlDataSource';
import { TYPES } from './types';

/**
 * Dependency Injection Container
 *
 * This is the main IoC (Inversion of Control) container for the application.
 * All services should be registered here and retrieved through the container.
 *
 * Usage:
 * ```typescript
 * import { container } from './core/di-container';
 * const configService = container.get<IConfigService>(TYPES.IConfigService);
 * ```
 *
 * For React components, use the useService hook (to be implemented in Phase 1).
 */

// Create the container
const container = new Container();

// Bind services to their interfaces
// All bindings use singleton scope to ensure single instances throughout the app
container.bind<IConfigService>(TYPES.IConfigService).to(ConfigService).inSingletonScope();
container
  .bind<IFeatureFlagService>(TYPES.IFeatureFlagService)
  .to(FeatureFlagService)
  .inSingletonScope();

container
  .bind<IHomeAssistantClient>(TYPES.IHomeAssistantClient)
  .to(HomeAssistantWebSocketClient)
  .inSingletonScope();

container
  .bind<IHomeAssistantConnectionConfig>(TYPES.IHomeAssistantConnectionConfig)
  .to(HomeAssistantConnectionConfigService)
  .inSingletonScope();

container
  .bind<IWebSocketService>(TYPES.IWebSocketService)
  .to(HomeAssistantWebSocketService)
  .inSingletonScope();

container.bind<IHttpClient>(TYPES.IHttpClient).to(HomeAssistantHttpClient).inSingletonScope();

container
  .bind<IEntityService>(TYPES.IEntityService)
  .to(HomeAssistantEntityService)
  .inSingletonScope();

// Prototype data sources (local-only, swappable later for HA)
container
  .bind<IFloorplanDataSource>(TYPES.IFloorplanDataSource)
  .to(PublicFloorplanYamlDataSource)
  .inSingletonScope();
container
  .bind<IClimateDataSource>(TYPES.IClimateDataSource)
  .to(PublicClimateYamlDataSource)
  .inSingletonScope();
container
  .bind<ILightingDataSource>(TYPES.ILightingDataSource)
  .to(PublicLightingYamlDataSource)
  .inSingletonScope();

// Home Assistant registries (device/entity metadata for labeling, etc.)
container
  .bind<IDeviceTrackerMetadataService>(TYPES.IDeviceTrackerMetadataService)
  .to(HomeAssistantDeviceTrackerMetadataService)
  .inSingletonScope();

// Export the configured container
export { container };
