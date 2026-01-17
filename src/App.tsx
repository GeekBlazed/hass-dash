import { Dashboard } from './components/dashboard';
import { DebugPanel } from './components/DebugPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const showDebugPanel =
    import.meta.env.DEV &&
    (() => {
      try {
        return new URLSearchParams(window.location.search).has('debug');
      } catch {
        return false;
      }
    })();

  return (
    <ErrorBoundary>
      <Dashboard />
      {showDebugPanel && (
        <div className="fixed z-50" style={{ right: '8px', top: '8px' }}>
          <DebugPanel />
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
