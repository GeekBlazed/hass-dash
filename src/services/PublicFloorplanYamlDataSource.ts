import type { ErrorObject, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import { injectable } from 'inversify';
import type { FloorplanModel } from '../features/model/floorplan';
import { normalizeFloorplan } from '../features/model/floorplan';
import { parseYaml } from '../features/parsing/parseYaml';
import type { IFloorplanDataSource } from '../interfaces/IFloorplanDataSource';

const FLOORPLAN_YAML_URL = '/data/floorplan.yaml';
const FLOORPLAN_SCHEMA_URL = '/schemas/floorplan.schema.json';

let floorplanValidatorPromise: Promise<ValidateFunction<FloorplanModel>> | undefined;

const formatAjvErrors = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors?.length) return 'Unknown schema validation error.';

  return errors
    .slice(0, 10)
    .map((e) => {
      const path = e.instancePath && e.instancePath.length ? e.instancePath : '/';
      const msg = e.message ?? 'invalid';
      return `${path} ${msg}`;
    })
    .join('; ');
};

const getFloorplanValidator = async (): Promise<ValidateFunction<FloorplanModel>> => {
  if (!floorplanValidatorPromise) {
    floorplanValidatorPromise = (async () => {
      const response = await fetch(FLOORPLAN_SCHEMA_URL);
      if (!response.ok) {
        throw new Error(
          `Failed to load ${FLOORPLAN_SCHEMA_URL} (HTTP ${response.status}) for schema validation`
        );
      }

      const schema = (await response.json()) as object;

      const ajv = new Ajv2020({
        allErrors: true,
      });

      return ajv.compile<FloorplanModel>(schema);
    })();
  }

  return floorplanValidatorPromise;
};

@injectable()
export class PublicFloorplanYamlDataSource implements IFloorplanDataSource {
  async getFloorplan(): Promise<FloorplanModel> {
    const response = await fetch(FLOORPLAN_YAML_URL);

    if (!response.ok) {
      throw new Error(`Failed to load ${FLOORPLAN_YAML_URL} (HTTP ${response.status})`);
    }

    const text = await response.text();
    const doc = parseYaml(text);

    const model = normalizeFloorplan(doc);

    const validate = await getFloorplanValidator();
    if (!validate(model)) {
      const details = formatAjvErrors(validate.errors);
      throw new Error(`Floorplan schema validation failed for ${FLOORPLAN_YAML_URL}: ${details}`);
    }

    return model;
  }
}
