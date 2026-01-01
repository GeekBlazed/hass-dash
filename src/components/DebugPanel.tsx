import { useFeatureFlags } from '../hooks/useFeatureFlag';

/**
 * Debug Panel Component
 *
 * Displays all feature flags and their current states.
 * Only shown when VITE_FEATURE_DEBUG_PANEL is enabled.
 * Allows toggling flags in development mode.
 */
export function DebugPanel() {
  const { flags, service } = useFeatureFlags();

  const handleToggle = (flag: string, currentState: boolean) => {
    if (currentState) {
      service.disable(flag);
    } else {
      service.enable(flag);
    }
    // Force re-render by causing a state update
    window.location.reload();
  };

  const isDevelopment = import.meta.env.DEV;

  return (
    <div className="mt-8 rounded-lg border-2 border-blue-500/30 bg-blue-50 p-4 dark:bg-blue-900/20">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">🚩</span>
        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">Feature Flags</h2>
      </div>

      <div className="space-y-2">
        {Object.entries(flags).length === 0 ? (
          <p className="text-sm text-blue-700 dark:text-blue-300">No feature flags defined</p>
        ) : (
          Object.entries(flags).map(([name, enabled]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded bg-white p-2 dark:bg-gray-800"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{enabled ? '✅' : '❌'}</span>
                <code className="font-mono text-sm text-gray-700 dark:text-gray-300">{name}</code>
              </div>

              {isDevelopment && (
                <button
                  onClick={() => handleToggle(name, enabled)}
                  className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                  aria-label={`Toggle ${name} flag`}
                >
                  Toggle
                </button>
              )}

              {!isDevelopment && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {isDevelopment && (
        <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
          💡 Dev Mode: Toggle flags to test features. Changes persist in sessionStorage.
        </p>
      )}
    </div>
  );
}
