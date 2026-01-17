export interface ThermostatModel {
  name: string;
  unit: string;
  precision: number;
  setTemperature: number;
  hvacMode: string;
  fanMode?: string;
  measuredTemperature: number;
  measuredHumidity?: number;
}

export interface ClimateAreaModel {
  areaId: string;
  temp: number;
  humidity?: number;
}

export interface ClimateModel {
  thermostat: ThermostatModel;
  areas: ClimateAreaModel[];
}

interface RawClimateDoc {
  thermostat?: {
    default?: Record<string, unknown>;
  };
  areas?: Array<Record<string, unknown>>;
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

const asNullableNumber = (value: unknown): number | undefined => {
  if (value === null) return undefined;
  return asNumber(value);
};

const DEFAULT_MODEL: ClimateModel = {
  thermostat: {
    name: 'Home Temperature',
    unit: '°F',
    precision: 1,
    setTemperature: 70,
    hvacMode: 'cool',
    fanMode: 'auto',
    measuredTemperature: 71,
    measuredHumidity: 47,
  },
  areas: [],
};

/**
 * Normalize the climate YAML document into a stable model.
 *
 * This is intentionally forgiving: missing/invalid content yields defaults.
 */
export function normalizeClimate(doc: unknown): ClimateModel {
  if (!isRecord(doc)) return DEFAULT_MODEL;

  const raw = doc as RawClimateDoc;
  const t =
    isRecord(raw.thermostat) && isRecord(raw.thermostat.default) ? raw.thermostat.default : null;

  const name = t ? asString(t.name) : undefined;
  const unit = t ? asString(t.unit) : undefined;
  const precision = t ? asNumber(t.precision) : undefined;
  const setTemperature = t ? asNumber(t.set_temperature) : undefined;
  const hvacMode = t ? asString(t.hvac_mode) : undefined;
  const fanMode = t ? asString(t.fan_mode) : undefined;
  const measuredTemperature = t ? asNumber(t.measured_temperature) : undefined;
  const measuredHumidity = t ? asNullableNumber(t.measured_humidity) : undefined;

  const thermostat: ThermostatModel = {
    name: name ?? DEFAULT_MODEL.thermostat.name,
    unit: unit ?? DEFAULT_MODEL.thermostat.unit,
    precision: precision ?? DEFAULT_MODEL.thermostat.precision,
    setTemperature: setTemperature ?? DEFAULT_MODEL.thermostat.setTemperature,
    hvacMode: hvacMode ?? DEFAULT_MODEL.thermostat.hvacMode,
    fanMode: fanMode ?? DEFAULT_MODEL.thermostat.fanMode,
    measuredTemperature: measuredTemperature ?? DEFAULT_MODEL.thermostat.measuredTemperature,
    measuredHumidity: measuredHumidity ?? DEFAULT_MODEL.thermostat.measuredHumidity,
  };

  const areasRaw = Array.isArray(raw.areas) ? raw.areas : [];
  const areas: ClimateAreaModel[] = [];

  for (const item of areasRaw) {
    if (!isRecord(item)) continue;

    const areaId = asString(item.area_id);
    const temp = asNumber(item.temp);

    if (!areaId || temp === undefined) continue;

    areas.push({
      areaId,
      temp,
      humidity: asNullableNumber(item.humidity),
    });
  }

  return { thermostat, areas };
}

export function getAreaTemperature(model: ClimateModel, areaId: string): number | undefined {
  return model.areas.find((a) => a.areaId === areaId)?.temp;
}

export function getAreaHumidity(model: ClimateModel, areaId: string): number | undefined {
  return model.areas.find((a) => a.areaId === areaId)?.humidity;
}
