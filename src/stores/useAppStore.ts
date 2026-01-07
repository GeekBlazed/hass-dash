import { produce } from 'immer';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

interface AppState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;

  // Planned for future use. Keeping this in the app store makes it easy to
  // centralize UI-driven overrides without requiring services to own storage.
  featureFlagOverrides: Record<string, boolean>;
  setFeatureFlagOverride: (flag: string, enabled: boolean) => void;
  clearFeatureFlagOverride: (flag: string) => void;
  clearAllFeatureFlagOverrides: () => void;
}

function normalizeFlagName(flag: string): string {
  return flag.trim().toUpperCase();
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'system',
        setTheme: (theme) => {
          set({ theme });
        },

        featureFlagOverrides: {},
        setFeatureFlagOverride: (flag, enabled) => {
          const normalized = normalizeFlagName(flag);
          set((state) =>
            produce(state, (draft) => {
              draft.featureFlagOverrides[normalized] = enabled;
            })
          );
        },
        clearFeatureFlagOverride: (flag) => {
          const normalized = normalizeFlagName(flag);
          set((state) =>
            produce(state, (draft) => {
              delete draft.featureFlagOverrides[normalized];
            })
          );
        },
        clearAllFeatureFlagOverrides: () => {
          set({ featureFlagOverrides: {} });
        },
      }),
      {
        name: 'hass-dash:app',
        version: 1,
        partialize: (state) => ({
          theme: state.theme,
          featureFlagOverrides: state.featureFlagOverrides,
        }),
      }
    )
  )
);
