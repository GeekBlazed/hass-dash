import { ComponentShowcase } from './components/ComponentShowcase';
import { Dashboard } from './components/dashboard';
import { DebugPanel } from './components/DebugPanel';
import { useFeatureFlag } from './hooks/useFeatureFlag';

function App() {
  // Check feature flags
  const { isEnabled: showDebugPanel } = useFeatureFlag('DEBUG_PANEL');
  const { isEnabled: showComponentShowcase } = useFeatureFlag('COMPONENT_SHOWCASE');

  // Show component showcase if flag enabled
  if (showComponentShowcase) {
    return <ComponentShowcase />;
  }

  // Main dashboard UI
  return (
    <>
      <Dashboard />
      {showDebugPanel && (
        <div className="fixed right-4 bottom-4 z-50">
          <DebugPanel />
        </div>
      )}
    </>
  );
}

export default App;
