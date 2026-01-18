import { injectable } from 'inversify';

import type { IFeatureFlagService } from '../interfaces/IFeatureFlagService';

type FlagOverrides = Record<string, boolean>;

type Listener = () => void;

const OVERRIDES_STORAGE_KEY = 'hassdash:featureFlagOverrides';

const isNonProductionMode = (): boolean => import.meta.env.MODE !== 'production';

@injectable()
export class FeatureFlagService implements IFeatureFlagService {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isEnabled(flag: string): boolean {
    const envKey = this.toEnvKey(flag);

    const overrides = this.readOverrides();
    const override = overrides[envKey];
    if (override !== undefined) return override;

    const raw = import.meta.env[envKey];
    return String(raw).toLowerCase() === 'true';
  }

  getAll(): Record<string, boolean> {
    const envFlags: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(import.meta.env)) {
      if (!key.startsWith('VITE_FEATURE_') && !key.startsWith('VITE_OVERLAY_')) continue;
      envFlags[key] = String(value).toLowerCase() === 'true';
    }

    const overrides = this.readOverrides();

    return {
      ...envFlags,
      ...overrides,
    };
  }

  enable(flag: string): void {
    this.setOverride(flag, true);
  }

  disable(flag: string): void {
    this.setOverride(flag, false);
  }

  private setOverride(flag: string, enabled: boolean): void {
    if (!isNonProductionMode()) return;

    const envKey = this.toEnvKey(flag);
    const nextOverrides = { ...this.readOverrides(), [envKey]: enabled };
    this.writeOverrides(nextOverrides);
    this.emitChange();
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private readOverrides(): FlagOverrides {
    if (typeof window === 'undefined') return {};

    try {
      const raw = window.sessionStorage.getItem(OVERRIDES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};

      const record = parsed as Record<string, unknown>;
      const result: FlagOverrides = {};

      for (const [key, value] of Object.entries(record)) {
        if (typeof value !== 'boolean') continue;
        result[key] = value;
      }

      return result;
    } catch {
      return {};
    }
  }

  private writeOverrides(overrides: FlagOverrides): void {
    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // ignore
    }
  }

  private toEnvKey(flag: string): string {
    const raw = flag.trim().toUpperCase();

    if (raw.startsWith('VITE_FEATURE_') || raw.startsWith('VITE_OVERLAY_')) {
      return raw;
    }

    if (raw.startsWith('FEATURE_')) {
      return `VITE_${raw}`;
    }

    if (raw.startsWith('OVERLAY_')) {
      return `VITE_${raw}`;
    }

    return `VITE_FEATURE_${raw}`;
  }
}
