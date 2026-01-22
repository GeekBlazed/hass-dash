import type { MutableRefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { TYPES } from '../../../core/types';
import { useService } from '../../../hooks/useService';
import type { ILightService } from '../../../interfaces/ILightService';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityState } from '../../../types/home-assistant';

type LightColorMode =
  | 'onoff'
  | 'brightness'
  | 'color_temp'
  | 'hs'
  | 'rgb'
  | 'rgbw'
  | 'rgbww'
  | 'xy'
  | 'white'
  | string;

type LightAttributes = {
  friendly_name?: string;
  name?: string;
  supported_color_modes?: LightColorMode[];
  supported_features?: number;
  brightness?: number;
  rgb_color?: [number, number, number];
  color_temp?: number;
  min_mireds?: number;
  max_mireds?: number;
};

const HA_LIGHT_FEATURE_BRIGHTNESS = 1;
const HA_LIGHT_FEATURE_COLOR_TEMP = 2;
const HA_LIGHT_FEATURE_COLOR = 16;

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const getDisplayName = (entity: HaEntityState): string => {
  const attrs = entity.attributes as LightAttributes | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';
  return friendlyName.trim() || name.trim() || entity.entity_id;
};

const parseSupportedColorModes = (attrs: LightAttributes): LightColorMode[] => {
  const raw = attrs.supported_color_modes;
  return Array.isArray(raw) ? raw : [];
};

const hasFeature = (attrs: LightAttributes, flag: number): boolean => {
  return isFiniteNumber(attrs.supported_features) && (attrs.supported_features & flag) === flag;
};

const supportsBrightness = (attrs: LightAttributes): boolean => {
  // Home Assistant expresses capabilities primarily via `supported_color_modes`.
  // `onoff` means no dimming; most other modes imply brightness support.
  const modes = parseSupportedColorModes(attrs);
  if (modes.length === 0) {
    if (hasFeature(attrs, HA_LIGHT_FEATURE_BRIGHTNESS)) return true;
    return isFiniteNumber(attrs.brightness);
  }
  if (modes.includes('brightness')) return true;
  return modes.some((m) => m !== 'onoff');
};

const supportsColorTemperature = (attrs: LightAttributes): boolean => {
  const modes = parseSupportedColorModes(attrs);
  if (modes.length === 0) {
    if (hasFeature(attrs, HA_LIGHT_FEATURE_COLOR_TEMP)) return true;
    return isFiniteNumber(attrs.color_temp);
  }

  return modes.includes('color_temp');
};

const supportsRgbColor = (attrs: LightAttributes): boolean => {
  const modes = parseSupportedColorModes(attrs);
  if (modes.length === 0) {
    if (hasFeature(attrs, HA_LIGHT_FEATURE_COLOR)) return true;
    return Array.isArray(attrs.rgb_color) && attrs.rgb_color.length === 3;
  }

  return modes.some(
    (m) => m === 'rgb' || m === 'hs' || m === 'xy' || m === 'rgbw' || m === 'rgbww'
  );
};

const toHex2 = (value: number): string => {
  const v = clamp(Math.round(value), 0, 255);
  return v.toString(16).padStart(2, '0');
};

const rgbToHex = (rgb: [number, number, number]): string => {
  const [r, g, b] = rgb;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const raw = hex.trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (!match?.[1]) return null;
  const int = Number.parseInt(match[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return [r, g, b];
};

const miredToKelvin = (mired: number): number => {
  if (!Number.isFinite(mired) || mired <= 0) return 0;
  return Math.round(1_000_000 / mired);
};

type TimeoutHandle = ReturnType<typeof setTimeout>;

export function LightDetailsPanel({ entityId, onBack }: { entityId: string; onBack: () => void }) {
  const lightService = useService<ILightService>(TYPES.ILightService);
  const entity = useEntityStore((s) => s.entitiesById[entityId]);

  const attrs = useMemo(() => {
    const raw = (entity?.attributes ?? {}) as Record<string, unknown>;
    return raw as unknown as LightAttributes;
  }, [entity?.attributes]);

  const name = entity ? getDisplayName(entity) : entityId;

  const [brightness, setBrightness] = useState<number>(255);
  const [colorTemp, setColorTemp] = useState<number | null>(null);
  const [hexColor, setHexColor] = useState<string>('#ffffff');

  const brightnessTimerRef = useRef<TimeoutHandle | null>(null);
  const pendingBrightnessRef = useRef<number | null>(null);
  const lastSentBrightnessRef = useRef<number | null>(null);

  const colorTempTimerRef = useRef<TimeoutHandle | null>(null);
  const pendingColorTempRef = useRef<number | null>(null);
  const lastSentColorTempRef = useRef<number | null>(null);

  const clearTimer = (id: TimeoutHandle | null): void => {
    if (id === null) return;
    clearTimeout(id);
  };

  const schedule = (opts: {
    timerRef: MutableRefObject<TimeoutHandle | null>;
    getPending: () => number | null;
    getLastSent: () => number | null;
    setLastSent: (value: number) => void;
    send: (value: number) => void;
  }): void => {
    clearTimer(opts.timerRef.current);
    opts.timerRef.current = setTimeout(() => {
      opts.timerRef.current = null;
      const value = opts.getPending();
      if (typeof value !== 'number') return;
      if (opts.getLastSent() === value) return;
      opts.setLastSent(value);
      opts.send(value);
    }, 1000);
  };

  useEffect(() => {
    if (!entity) return;

    if (isFiniteNumber(attrs.brightness)) {
      setBrightness(clamp(attrs.brightness, 1, 255));
    }

    if (isFiniteNumber(attrs.color_temp)) {
      setColorTemp(attrs.color_temp);
    }

    if (Array.isArray(attrs.rgb_color) && attrs.rgb_color.length === 3) {
      const [r, g, b] = attrs.rgb_color;
      if ([r, g, b].every((n) => isFiniteNumber(n))) {
        setHexColor(rgbToHex([r, g, b]));
      }
    }
  }, [entityId, entity, attrs.brightness, attrs.color_temp, attrs.rgb_color]);

  useEffect(() => {
    // When switching entity or unmounting, cancel any pending debounced sends.
    return () => {
      clearTimer(brightnessTimerRef.current);
      brightnessTimerRef.current = null;
      pendingBrightnessRef.current = null;
      lastSentBrightnessRef.current = null;

      clearTimer(colorTempTimerRef.current);
      colorTempTimerRef.current = null;
      pendingColorTempRef.current = null;
      lastSentColorTempRef.current = null;
    };
  }, [entityId]);

  if (!entity) return null;

  const canBrightness = supportsBrightness(attrs);
  const canColorTemp = supportsColorTemperature(attrs);
  const canColor = supportsRgbColor(attrs);

  const minMireds = isFiniteNumber(attrs.min_mireds) ? attrs.min_mireds : 153;
  const maxMireds = isFiniteNumber(attrs.max_mireds) ? attrs.max_mireds : 500;

  return (
    <div className="lighting-details" aria-label={`Light details for ${name}`}>
      <div className="lighting-details__header">
        <button
          type="button"
          className="lighting-details__back"
          onClick={onBack}
          aria-label="Back to lights"
        >
          Back
        </button>
        <div className="lighting-details__title">{name}</div>
      </div>

      {canBrightness && (
        <label className="lighting-details__control" aria-label="Brightness">
          <div className="lighting-details__label">
            Brightness <span className="lighting-details__value">{brightness}</span>
          </div>
          <input
            type="range"
            min={1}
            max={255}
            value={brightness}
            onChange={(e) => {
              const next = clamp(Number(e.currentTarget.value), 1, 255);
              setBrightness(next);
              pendingBrightnessRef.current = next;
              schedule({
                timerRef: brightnessTimerRef,
                getPending: () => pendingBrightnessRef.current,
                getLastSent: () => lastSentBrightnessRef.current,
                setLastSent: (value) => {
                  lastSentBrightnessRef.current = value;
                },
                send: (value) => {
                  void lightService.setBrightness(entityId, value);
                },
              });
            }}
          />
        </label>
      )}

      {canColorTemp && (
        <label className="lighting-details__control" aria-label="Color temperature">
          <div className="lighting-details__label">
            Color temperature{' '}
            <span className="lighting-details__value">
              {colorTemp ?? ''}
              {colorTemp ? ` mired (${miredToKelvin(colorTemp)}K)` : ''}
            </span>
          </div>
          <input
            type="range"
            min={minMireds}
            max={maxMireds}
            value={colorTemp ?? minMireds}
            onChange={(e) => {
              const next = clamp(Number(e.currentTarget.value), minMireds, maxMireds);
              setColorTemp(next);
              pendingColorTempRef.current = next;
              schedule({
                timerRef: colorTempTimerRef,
                getPending: () => pendingColorTempRef.current,
                getLastSent: () => lastSentColorTempRef.current,
                setLastSent: (value) => {
                  lastSentColorTempRef.current = value;
                },
                send: (value) => {
                  void lightService.setColorTemperature(entityId, value);
                },
              });
            }}
          />
        </label>
      )}

      {canColor && (
        <label className="lighting-details__control" aria-label="Color">
          <div className="lighting-details__label">Color</div>
          <input
            type="color"
            value={hexColor}
            onChange={(e) => {
              const nextHex = e.currentTarget.value;
              setHexColor(nextHex);
              const rgb = hexToRgb(nextHex);
              if (!rgb) return;
              void lightService.setRgbColor(entityId, rgb);
            }}
          />
        </label>
      )}

      {!canBrightness && !canColorTemp && !canColor && (
        <div className="lighting-details__empty" aria-label="No supported controls">
          This light does not expose adjustable controls.
        </div>
      )}
    </div>
  );
}
