import { injectable } from 'inversify';
import { normalizeClimate } from '../features/prototype/model/climate';
import { parseYaml } from '../features/prototype/parsing/parseYaml';
import type { IClimateDataSource } from '../interfaces/IClimateDataSource';

@injectable()
export class PublicClimateYamlDataSource implements IClimateDataSource {
  async getClimate(): Promise<ReturnType<typeof normalizeClimate>> {
    const response = await fetch('/data/climate.yaml');

    if (!response.ok) {
      throw new Error(`Failed to load /data/climate.yaml (HTTP ${response.status})`);
    }

    const text = await response.text();
    const doc = parseYaml(text);

    return normalizeClimate(doc);
  }
}
