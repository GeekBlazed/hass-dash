import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

interface DevToolsState {
  debugPanelOpen: boolean;
  setDebugPanelOpen: (open: boolean) => void;
  toggleDebugPanel: () => void;
  syncFromUrl: () => void;
}

function setUrlDebugParam(enabled: boolean): void {
  try {
    const url = new URL(window.location.href);
    if (enabled) {
      url.searchParams.set('debug', '1');
    } else {
      url.searchParams.delete('debug');
    }
    window.history.replaceState({}, '', url.toString());
  } catch {
    // ignore
  }
}

export const useDevToolsStore = create<DevToolsState>()(
  devtools(
    persist(
      (set, get) => ({
        debugPanelOpen: false,
        setDebugPanelOpen: (open) => {
          set({ debugPanelOpen: open });
          setUrlDebugParam(open);
        },
        toggleDebugPanel: () => {
          const next = !get().debugPanelOpen;
          set({ debugPanelOpen: next });
          setUrlDebugParam(next);
        },
        syncFromUrl: () => {
          try {
            const enabled = new URLSearchParams(window.location.search).has('debug');
            set({ debugPanelOpen: enabled });
          } catch {
            set({ debugPanelOpen: false });
          }
        },
      }),
      {
        name: 'hass-dash:devtools',
        version: 1,
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          debugPanelOpen: state.debugPanelOpen,
        }),
      }
    ),
    {
      name: 'hass-dash:devtools',
    }
  )
);
