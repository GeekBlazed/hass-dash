import type { ClimateModel } from '../features/prototype/model/climate';

export interface IClimateDataSource {
  getClimate(): Promise<ClimateModel>;
}
