import { useEffect } from 'react';
import { Dashboard } from './components/dashboard';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LhciLightingModalHarness } from './components/lhci/LhciLightingModalHarness';
import { useDevToolsStore } from './stores/useDevToolsStore';
import { useEntityStore } from './stores/useEntityStore';

function App() {
  const isDevelopment = import.meta.env.DEV;
  const showDebugPanel = useDevToolsStore((s) => s.debugPanelOpen);
  const syncFromUrl = useDevToolsStore((s) => s.syncFromUrl);

  useEffect(() => {
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }

    if (!params.has('lhci')) return;

    if (params.get('lhciSeedLights') === '1') {
      const demoEntityId = 'light.lhci_demo';
      const nowIso = new Date().toISOString();
      const entityStore = useEntityStore.getState();

      const hasAnyLight = Object.keys(entityStore.entitiesById).some((id) =>
        id.startsWith('light.')
      );
      if (!hasAnyLight) {
        entityStore.upsert({
          entity_id: demoEntityId,
          state: 'on',
          attributes: {
            friendly_name: 'LHCI Demo Light',
            supported_color_modes: ['rgb', 'color_temp'],
            supported_features: 0,
            brightness: 200,
            rgb_color: [255, 180, 90],
            color_temp: 275,
            min_mireds: 153,
            max_mireds: 500,
          },
          last_changed: nowIso,
          last_updated: nowIso,
          context: {
            id: 'lhci',
            parent_id: null,
            user_id: null,
          },
        });
      }

      const currentHousehold = Object.keys(entityStore.householdEntityIds);
      const nextHousehold = new Set(currentHousehold);
      nextHousehold.add(demoEntityId);
      entityStore.setHouseholdEntityIds(nextHousehold);
    }
  }, []);

  // Preserve the existing dev-time ?debug entrypoint.
  // In production builds, ignore it entirely.
  useEffect(() => {
    if (!isDevelopment) return;
    syncFromUrl();
  }, [isDevelopment, syncFromUrl]);

  return (
    <ErrorBoundary>
      <Dashboard />
      <LhciLightingModalHarness />
      {isDevelopment && showDebugPanel && (
        <div className="fixed z-50" style={{ right: '8px', top: '8px' }}>
          <DebugPanel />
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
