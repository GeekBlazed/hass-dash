import { DebugPanel } from './components/DebugPanel';
import { TestFeature } from './components/TestFeature';
import { container } from './core/di-container';
import { TYPES } from './core/types';
import { useFeatureFlag } from './hooks/useFeatureFlag';
import type { IConfigService } from './interfaces/IConfigService';

function App() {
  // Get the ConfigService from the DI container
  const configService = container.get<IConfigService>(TYPES.IConfigService);
  const version = configService.getAppVersion();

  // Check feature flags
  const { isEnabled: showDebugPanel } = useFeatureFlag('DEBUG_PANEL');
  const { isEnabled: showTestFeature } = useFeatureFlag('FLOOR_PLAN');

  return (
    <div className="from-surface-light flex min-h-screen items-center justify-center bg-gradient-to-br to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="border-primary/20 dark:border-primary-dark/30 w-full max-w-md rounded-2xl border-2 bg-white p-8 shadow-2xl dark:bg-gray-800">
        {/* Header with Icon and Title */}
        <div className="mb-6 text-center">
          <div className="mb-4 text-6xl">🏠</div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
            Home Assistant Dashboard
          </h1>
          <p className="text-primary dark:text-primary-light text-lg font-semibold">
            hass-dash v{version}
          </p>
        </div>

        {/* Tagline */}
        <p className="mb-6 text-center text-xl text-gray-700 dark:text-gray-300">
          Your smart home, visualized.
        </p>

        {/* Status Indicator */}
        <div className="mb-8 flex items-center justify-center rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
          <span className="mr-2 text-2xl">🟡</span>
          <span className="font-medium text-yellow-800 dark:text-yellow-200">Development Mode</span>
        </div>

        {/* Links */}
        <div className="flex justify-center gap-4">
          <a
            href="https://github.com/GeekBlazed/hass-dash/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary-dark focus:ring-primary dark:bg-primary-dark dark:hover:bg-primary rounded-lg px-6 py-3 font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          >
            Documentation
          </a>
          <a
            href="https://github.com/GeekBlazed/hass-dash"
            target="_blank"
            rel="noopener noreferrer"
            className="border-primary text-primary hover:bg-primary focus:ring-primary dark:border-primary-light dark:text-primary-light dark:hover:bg-primary-light rounded-lg border-2 px-6 py-3 font-semibold transition-colors hover:text-white focus:ring-2 focus:ring-offset-2 focus:outline-none dark:hover:text-gray-900"
          >
            GitHub
          </a>
        </div>

        {/* Footer Note */}
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Press{' '}
          <kbd className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold dark:bg-gray-700">
            F12
          </kbd>{' '}
          to open developer tools
        </p>

        {/* Test Feature (feature-flagged) */}
        {showTestFeature && <TestFeature />}

        {/* Debug Panel (feature-flagged) */}
        {showDebugPanel && <DebugPanel />}
      </div>
    </div>
  );
}

export default App;
