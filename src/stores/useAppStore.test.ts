import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.persist.clearStorage();
    useAppStore.setState({ theme: 'system', featureFlagOverrides: {} });
  });

  it('defaults to system theme', () => {
    expect(useAppStore.getState().theme).toBe('system');
  });

  it('can set theme and persist it', async () => {
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().theme).toBe('dark');

    const storage = useAppStore.persist.getOptions().storage;
    expect(storage).toBeDefined();
    const raw = await Promise.resolve(storage?.getItem('hass-dash:app'));
    expect(raw).not.toBeNull();

    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as { state?: { theme?: string } })
        : (raw as { state?: { theme?: string } });

    expect(parsed.state?.theme).toBe('dark');
  });

  it('normalizes feature flag override keys', () => {
    useAppStore.getState().setFeatureFlagOverride('  debug_panel ', true);
    expect(useAppStore.getState().featureFlagOverrides.DEBUG_PANEL).toBe(true);
  });

  it('can clear an override', () => {
    useAppStore.getState().setFeatureFlagOverride('DEBUG_PANEL', true);
    useAppStore.getState().clearFeatureFlagOverride('debug_panel');

    expect(useAppStore.getState().featureFlagOverrides.DEBUG_PANEL).toBeUndefined();
  });
});
