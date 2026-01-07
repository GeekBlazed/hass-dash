/**
 * Dependency Injection Type Identifiers
 *
 * This file contains all the type identifiers used for dependency injection
 * with InversifyJS. Each service interface should have a corresponding
 * symbol defined here.
 *
 * Usage:
 * - In DI container: container.bind<IServiceName>(TYPES.IServiceName).to(ServiceName)
 * - In constructor: @inject(TYPES.IServiceName) private service: IServiceName
 */

export const TYPES = {
  IConfigService: Symbol.for('IConfigService'),
  IFeatureFlagService: Symbol.for('IFeatureFlagService'),
  IHomeAssistantClient: Symbol.for('IHomeAssistantClient'),

  IFloorplanDataSource: Symbol.for('IFloorplanDataSource'),
  IClimateDataSource: Symbol.for('IClimateDataSource'),
  ILightingDataSource: Symbol.for('ILightingDataSource'),
};
