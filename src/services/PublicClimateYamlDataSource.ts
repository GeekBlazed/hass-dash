import { injectable } from 'inversify';
import type { ClimateModel } from '../features/prototype/model/climate';
import { normalizeClimate } from '../features/prototype/model/climate';
import type { IClimateDataSource } from '../interfaces/IClimateDataSource';

@injectable()
export class PublicClimateYamlDataSource implements IClimateDataSource {
  async getClimate(): Promise<ClimateModel> {
    // Legacy prototype YAML models were removed; keep the interface stable and
    // return an empty model (React UI is HA-driven).
    return normalizeClimate(null);
  }
}
