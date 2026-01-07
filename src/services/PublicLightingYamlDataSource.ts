import { injectable } from 'inversify';
import type { LightingModel } from '../features/prototype/model/lighting';
import { normalizeLighting } from '../features/prototype/model/lighting';
import { parseYaml } from '../features/prototype/parsing/parseYaml';
import type { ILightingDataSource } from '../interfaces/ILightingDataSource';

@injectable()
export class PublicLightingYamlDataSource implements ILightingDataSource {
  async getLighting(): Promise<LightingModel> {
    const response = await fetch('/data/lighting.yaml');

    // Per parity/prototype rules: lighting.yaml is optional.
    if (!response.ok) {
      return { lights: [] };
    }

    try {
      const text = await response.text();
      const doc = parseYaml(text);
      return normalizeLighting(doc);
    } catch {
      return { lights: [] };
    }
  }
}
