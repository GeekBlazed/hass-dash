import type { LightingModel } from '../features/prototype/model/lighting';

export interface ILightingDataSource {
  getLighting(): Promise<LightingModel>;
}
