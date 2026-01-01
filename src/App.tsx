import { ComponentShowcase } from './components/ComponentShowcase';
import { DebugPanel } from './components/DebugPanel';
import { DemoDevices } from './components/DemoDevices';
import { DemoFloorPlan } from './components/DemoFloorPlan';
import { DemoStats } from './components/DemoStats';
import { Layout } from './components/Layout';
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
  const { isEnabled: useNewLayout } = useFeatureFlag('NAVIGATION');
  const { isEnabled: showComponentShowcase } = useFeatureFlag('COMPONENT_SHOWCASE');

  // Use new layout if NAVIGATION flag is enabled, otherwise show old welcome screen
  if (!useNewLayout) {
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
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              Development Mode
            </span>
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

  // New layout with header and footer
  return (
    <Layout>
      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <div className="mb-6 text-8xl">🏠</div>
          <h1 className="mb-4 text-5xl font-bold text-gray-900 dark:text-white">
            Welcome to HassDash
          </h1>
          <p className="mb-8 text-2xl text-gray-600 dark:text-gray-300">
            Your smart home, visualized.
          </p>

          {/* Status Badge */}
          <div className="mb-12 inline-flex items-center gap-2 rounded-full bg-yellow-50 px-6 py-3 shadow-sm dark:bg-yellow-900/20">
            <span className="text-2xl">🟡</span>
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              Development Mode - Iteration 1.2 Complete
            </span>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Feature 1: Floor Plan */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">🗺️</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              2D Floor Plan
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Interactive spatial visualization of your home layout
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Phase 3 - Coming Soon
            </span>
          </div>

          {/* Feature 2: Lighting */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">💡</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Lighting Control
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              View and control all lights with color and brightness
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Phase 4 - Coming Soon
            </span>
          </div>

          {/* Feature 3: Climate */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">🌡️</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Climate Heat Map
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Temperature visualization across all rooms
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Phase 4 - Coming Soon
            </span>
          </div>

          {/* Feature 4: Cameras */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">📹</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Surveillance
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Live camera feeds and motion detection
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Future Phase
            </span>
          </div>

          {/* Feature 5: Home Assistant */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">🔌</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              HA Integration
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Real-time connection to Home Assistant
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Phase 2 - Coming Soon
            </span>
          </div>

          {/* Feature 6: PWA */}
          <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 text-4xl">📱</div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Progressive Web App
            </h3>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Install on any device, works offline
            </p>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Phase 5 - Coming Soon
            </span>
          </div>
        </div>

        {/* Current Progress */}
        <div className="mt-16 rounded-xl border border-green-200 bg-green-50 p-8 dark:border-green-800 dark:bg-green-900/20">
          <h2 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
            ✅ What's Been Built
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Project Setup</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Vite, React, TypeScript, Tailwind
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">DI Container</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  InversifyJS with service interfaces
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Feature Flags</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Runtime toggles for dev features
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Layout System</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Header, footer, dark mode toggle
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">UI Components</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Radix UI + Tailwind Button & Dialog
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Test Coverage</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  99 tests, 90.97% coverage
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Demo Section */}
        <div className="mt-16">
          <h2 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
            🎮 Live Demo
          </h2>

          {/* Stats */}
          <DemoStats />

          {/* Floor Plan and Device Controls */}
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <DemoFloorPlan />
            <DemoDevices />
          </div>
        </div>
      </div>

      {/* Feature-flagged components */}
      {showTestFeature && (
        <div className="mt-8">
          <TestFeature />
        </div>
      )}
      {showDebugPanel && (
        <div className="mt-8">
          <DebugPanel />
        </div>
      )}
      {showComponentShowcase && (
        <div className="mt-8">
          <ComponentShowcase />
        </div>
      )}
    </Layout>
  );
}

export default App;
