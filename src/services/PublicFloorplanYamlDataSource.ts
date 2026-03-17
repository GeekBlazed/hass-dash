import type { ErrorObject, ValidateFunction } from 'ajv';
import { injectable } from 'inversify';
import type { FloorplanModel } from '../features/model/floorplan';
import { normalizeFloorplan } from '../features/model/floorplan';
import { parseYaml } from '../features/parsing/parseYaml';
import type { IFloorplanDataSource } from '../interfaces/IFloorplanDataSource';

// In production, the build emits a pre-converted floorplan.json so the browser
// can use the native JSON parser instead of downloading the yaml library chunk.
// In development, use the YAML source file directly for easier editing.
const FLOORPLAN_URL = import.meta.env.DEV ? '/data/floorplan.yaml' : '/data/floorplan.json';
const FLOORPLAN_SCHEMA_URL = '/schemas/floorplan.schema.json';

const MAX_FORMATTED_ERRORS = 10;
let floorplanValidatorPromise: Promise<ValidateFunction<FloorplanModel>> | undefined;

const formatAjvErrors = (errors: ErrorObject[] | null | undefined): string => {
  if (!errors?.length) return 'Unknown schema validation error.';

  return errors
    .slice(0, MAX_FORMATTED_ERRORS)
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

      const { default: Ajv2020 } = await import('ajv/dist/2020');

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
    const response = await fetch(FLOORPLAN_URL);

    if (!response.ok) {
      throw new Error(`Failed to load ${FLOORPLAN_URL} (HTTP ${response.status})`);
    }

    let doc: unknown;
    if (import.meta.env.DEV) {
      // Development: YAML source file — parse with the yaml library.
      const text = await response.text();
      try {
        doc = await parseYaml(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse YAML from ${FLOORPLAN_URL}: ${message}`);
      }
    } else {
      // Production: pre-built JSON — native JSON.parse, no extra chunk download.
      try {
        doc = (await response.json()) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse JSON from ${FLOORPLAN_URL}: ${message}`);
      }
    }

    const model = normalizeFloorplan(doc);

    // AJV is intentionally dev/test-only. In production, this is hot-path work that
    // increases JS payload and parse/exec cost, while the bundled floorplan schema is
    // expected to be stable and validated as part of release/CI tooling. If the
    // production floorplan ever diverges from the schema, the mismatch will surface
    // later (e.g., during normalization or when consuming the model) as runtime
    // errors or incorrect rendering rather than as an explicit validation error here.
    const shouldValidateSchema = import.meta.env.DEV || import.meta.env.MODE === 'test';
    if (shouldValidateSchema) {
      const validate = await getFloorplanValidator();
      if (!validate(model)) {
        const details = formatAjvErrors(validate.errors);
        throw new Error(`Floorplan schema validation failed for ${FLOORPLAN_URL}: ${details}`);
      }
    }

    return model;
  }
}
