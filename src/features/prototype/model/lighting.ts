export type LightPowerState = 'on' | 'off';

export interface LightingLight {
  id: string;
  name: string;
  state: LightPowerState;
  brightness?: number;
  colorTemp?: number;
}

export interface LightingModel {
  lights: LightingLight[];
}

interface RawLightingDoc {
  lights?: Array<{
    id?: unknown;
    name?: unknown;
    state?: unknown;
    brightness?: unknown;
    color_temp?: unknown;
  }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const asLightState = (value: unknown): LightPowerState | undefined => {
  if (value === 'on' || value === 'off') return value;
  return undefined;
};

/**
 * Normalize the lighting YAML document into a stable model.
 *
 * This is intentionally forgiving: missing/invalid content yields an empty list.
 */
export function normalizeLighting(doc: unknown): LightingModel {
  if (!isRecord(doc)) return { lights: [] };

  const raw = doc as RawLightingDoc;
  const lights = Array.isArray(raw.lights) ? raw.lights : [];

  const normalized: LightingLight[] = [];

  for (const item of lights) {
    if (!isRecord(item)) continue;

    const id = asString(item.id);
    const name = asString(item.name);
    const state = asLightState(item.state);

    if (!id || !name || !state) continue;

    normalized.push({
      id,
      name,
      state,
      brightness: asNumber(item.brightness),
      colorTemp: asNumber(item.color_temp),
    });
  }

  return { lights: normalized };
}

export function getOnLights(model: LightingModel): LightingLight[] {
  return model.lights.filter((l) => l.state === 'on');
}
