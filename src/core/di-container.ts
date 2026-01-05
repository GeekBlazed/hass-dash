import { Container } from 'inversify';
import 'reflect-metadata';
import type { IConfigService } from '../interfaces/IConfigService';
import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { ConfigService } from '../services/ConfigService';
import { FeatureFlagService } from '../services/FeatureFlagService';
import { HomeAssistantWebSocketClient } from '../services/HomeAssistantWebSocketClient';
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

// Export the configured container
export { container };
