import { ComponentShowcase } from './components/ComponentShowcase';
import { Dashboard } from './components/dashboard';
import { DebugPanel } from './components/DebugPanel';
import { PrototypeShell } from './components/prototype/PrototypeShell';
import { useFeatureFlag } from './hooks/useFeatureFlag';

function App() {
  // Check feature flags
  const envDebugPanelRaw = import.meta.env.VITE_FEATURE_DEBUG_PANEL;
  const envDebugPanelEnabled =
    typeof envDebugPanelRaw === 'string'
      ? envDebugPanelRaw.trim().toLowerCase() === 'true'
      : envDebugPanelRaw === true;

  const { isEnabled: debugPanelFlagEnabled } = useFeatureFlag('DEBUG_PANEL');
  const { isEnabled: showComponentShowcase } = useFeatureFlag('COMPONENT_SHOWCASE');
  const { isEnabled: showPrototypeUI } = useFeatureFlag('PROTOTYPE_UI');

  // NOTE: Feature flag overrides live in sessionStorage. If DEBUG_PANEL was
  // toggled off previously, you'd be locked out of re-enabling it.
  // So we show the panel if either the env flag is enabled OR the flag service
  // reports it enabled.
  const showDebugPanel = envDebugPanelEnabled || debugPanelFlagEnabled;

  // Prototype → React parity UI (feature-flagged)
  if (showPrototypeUI) {
    return (
      <>
        {showDebugPanel && (
          <div className="fixed z-50" style={{ right: '8px', top: '8px' }}>
            <DebugPanel />
          </div>
        )}
        <PrototypeShell />
      </>
    );
  }

  // Show component showcase if flag enabled
  if (showComponentShowcase) {
    return <ComponentShowcase />;
  }

  // Main dashboard UI
  return (
    <>
      <Dashboard />
      {showDebugPanel && (
        <div className="fixed z-50" style={{ right: '8px', top: '8px' }}>
          <DebugPanel />
        </div>
      )}
    </>
  );
}

export default App;
