import type { FloorplanModel } from '../features/prototype/model/floorplan';

export interface IFloorplanDataSource {
  getFloorplan(): Promise<FloorplanModel>;
}
