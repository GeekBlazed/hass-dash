import { useEffect } from 'react';
import { Dashboard } from './components/dashboard';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useDevToolsStore } from './stores/useDevToolsStore';

function App() {
  const isDevelopment = import.meta.env.DEV;
  const showDebugPanel = useDevToolsStore((s) => s.debugPanelOpen);
  const syncFromUrl = useDevToolsStore((s) => s.syncFromUrl);

  // Preserve the existing dev-time ?debug entrypoint.
  // In production builds, ignore it entirely.
  useEffect(() => {
    if (!isDevelopment) return;
    syncFromUrl();
  }, [isDevelopment, syncFromUrl]);

  return (
    <ErrorBoundary>
      <Dashboard />
      {isDevelopment && showDebugPanel && (
        <div className="fixed z-50" style={{ right: '8px', top: '8px' }}>
          <DebugPanel />
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
