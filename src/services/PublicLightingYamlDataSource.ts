import { injectable } from 'inversify';
import type { LightingModel } from '../features/prototype/model/lighting';
import type { ILightingDataSource } from '../interfaces/ILightingDataSource';

@injectable()
export class PublicLightingYamlDataSource implements ILightingDataSource {
  async getLighting(): Promise<LightingModel> {
    // Legacy prototype YAML models were removed; keep the interface stable and
    // return an empty model (LightingPanel will show its empty state).
    return { lights: [] };
  }
}
