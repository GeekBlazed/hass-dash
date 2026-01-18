import type { AnySchema, ValidateFunction } from 'ajv';
import Ajv from 'ajv/dist/2020';

import type { FloorplanModel } from './floorplan';

// NOTE: Ajv's `JSONSchemaType<T>` typing models tuple validation using `items: [...]`.
// In JSON Schema draft 2020-12, tuples are represented via `prefixItems`.
// We keep the schema draft-correct for runtime validation, and relax the TS type here
// to avoid a false mismatch between TS tuple types and the draft-2020 schema shape.
const floorplanModelSchema: unknown = {
  $id: 'https://hass-dash.local/schemas/floorplan.schema.json',
  title: 'FloorplanModel',
  type: 'object',
  additionalProperties: false,
  required: ['defaultFloorId', 'floors'],
  properties: {
    defaultFloorId: { type: 'string', minLength: 1 },
    gps: {
      type: 'object',
      nullable: true,
      additionalProperties: false,
      required: ['latitude', 'longitude', 'elevation'],
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        elevation: { type: 'number' },
      },
    },
    floors: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'rooms'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          rooms: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'name', 'points'],
              properties: {
                id: { type: 'string', minLength: 1 },
                name: { type: 'string', minLength: 1 },
                points: {
                  type: 'array',
                  minItems: 3,
                  items: {
                    type: 'array',
                    prefixItems: [{ type: 'number' }, { type: 'number' }],
                    items: false,
                    minItems: 2,
                    maxItems: 2,
                  },
                },
              },
            },
          },
          bounds: {
            type: 'object',
            nullable: true,
            additionalProperties: false,
            required: ['minX', 'minY', 'maxX', 'maxY'],
            properties: {
              minX: { type: 'number' },
              minY: { type: 'number' },
              maxX: { type: 'number' },
              maxY: { type: 'number' },
            },
          },
          initialView: {
            type: 'object',
            nullable: true,
            additionalProperties: false,
            required: ['scale', 'x', 'y'],
            properties: {
              scale: { type: 'number' },
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
        },
      },
    },
    nodes: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'point'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          point: {
            type: 'array',
            prefixItems: [{ type: 'number' }, { type: 'number' }, { type: 'number' }],
            items: false,
            minItems: 3,
            maxItems: 3,
          },
          floor: { type: 'string', nullable: true },
          room: { type: 'string', nullable: true },
        },
      },
    },
  },
};

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validateFloorplanModel: ValidateFunction<FloorplanModel> = ajv.compile<FloorplanModel>(
  floorplanModelSchema as AnySchema
);

function formatAjvErrors(errors: typeof validateFloorplanModel.errors): string {
  if (!errors || errors.length === 0) return 'Unknown schema validation error.';
  return errors
    .map((e) => {
      const path = e.instancePath || '(root)';
      const msg = e.message ?? 'invalid';
      return `${path}: ${msg}`;
    })
    .join('; ');
}

export function parseFloorplanModelJson(doc: unknown): FloorplanModel {
  if (validateFloorplanModel(doc)) {
    return doc;
  }

  throw new Error(`Invalid floorplan JSON: ${formatAjvErrors(validateFloorplanModel.errors)}`);
}

export async function loadFloorplanModelJson(url: string): Promise<FloorplanModel> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
  }

  const json = (await response.json()) as unknown;
  return parseFloorplanModelJson(json);
}
