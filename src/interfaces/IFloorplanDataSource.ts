import type { FloorplanModel } from '../features/model/floorplan';

export interface IFloorplanDataSource {
  getFloorplan(): Promise<FloorplanModel>;
}
