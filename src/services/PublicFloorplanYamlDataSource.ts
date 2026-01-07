import { injectable } from 'inversify';
import type { FloorplanModel } from '../features/prototype/model/floorplan';
import { normalizeFloorplan } from '../features/prototype/model/floorplan';
import { parseYaml } from '../features/prototype/parsing/parseYaml';
import type { IFloorplanDataSource } from '../interfaces/IFloorplanDataSource';

@injectable()
export class PublicFloorplanYamlDataSource implements IFloorplanDataSource {
  async getFloorplan(): Promise<FloorplanModel> {
    const response = await fetch('/data/floorplan.yaml');

    if (!response.ok) {
      throw new Error(`Failed to load /data/floorplan.yaml (HTTP ${response.status})`);
    }

    const text = await response.text();
    const doc = parseYaml(text);

    return normalizeFloorplan(doc);
  }
}
