import { useMemo, useState } from 'react';
import { container } from '../core/di-container';
import { TYPES } from '../core/types';
import { useFeatureFlags } from '../hooks/useFeatureFlag';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { HaStateChangedEventData } from '../types/home-assistant';

/**
 * Debug Panel Component
 *
 * Displays all feature flags and their current states.
 * Only shown when VITE_FEATURE_DEBUG_PANEL is enabled.
 * Allows toggling flags in development mode.
 */
export function DebugPanel() {
  const { flags, service } = useFeatureFlags();

  const homeAssistantClient = useMemo(
    () => container.get<IHomeAssistantClient>(TYPES.IHomeAssistantClient),
    []
  );

  const [haTestStatus, setHaTestStatus] = useState<
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'success'; statesCount: number; servicesDomainsCount: number }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  const [haLightToggleStatus, setHaLightToggleStatus] = useState<
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'success'; entityId: string; currentState: string }
    | { state: 'error'; message: string }
  >({ state: 'idle' });

  const testLightEntityId = 'light.norad_corner_torch';

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

  const showHaSmokeTest = Boolean(flags.HA_CONNECTION) && isDevelopment;

  const runHaSmokeTest = async (): Promise<void> => {
    setHaTestStatus({ state: 'running' });

    try {
      await homeAssistantClient.connect();
      const [states, services] = await Promise.all([
        homeAssistantClient.getStates(),
        homeAssistantClient.getServices(),
      ]);

      setHaTestStatus({
        state: 'success',
        statesCount: states.length,
        servicesDomainsCount: services.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setHaTestStatus({ state: 'error', message });
    }
  };

  const runHaLightToggleTest = async (): Promise<void> => {
    setHaLightToggleStatus({ state: 'running' });

    try {
      await homeAssistantClient.connect();

      const before = await homeAssistantClient.getState(testLightEntityId);
      const previousState = before?.state ?? null;

      await homeAssistantClient.callService({
        domain: 'light',
        service: 'toggle',
        service_data: { entity_id: testLightEntityId },
      });

      // call_service is not guaranteed to synchronously reflect in getState.
      // Wait for the state_changed event for this entity to avoid reporting the previous state.
      const nextStateFromEvent = await new Promise<string | null>((resolve) => {
        let done = false;
        let unsubscribe: (() => Promise<void>) | undefined;

        const finish = (state: string | null) => {
          if (done) return;
          done = true;
          window.clearTimeout(timeoutId);
          if (unsubscribe) {
            void unsubscribe();
          }
          resolve(state);
        };

        const timeoutId = window.setTimeout(() => finish(null), 4000);

        void (async () => {
          const subscription = await homeAssistantClient.subscribeToEvents<HaStateChangedEventData>(
            'state_changed',
            (event) => {
              const data = event.data;
              if (!data || data.entity_id !== testLightEntityId) return;
              const next = data.new_state?.state ?? null;
              if (!next) return;

              if (previousState === null || next !== previousState) {
                finish(next);
              }
            }
          );

          unsubscribe = subscription.unsubscribe;
        })();
      });

      const currentState =
        nextStateFromEvent ??
        (await homeAssistantClient.getState(testLightEntityId))?.state ??
        'unknown';

      setHaLightToggleStatus({
        state: 'success',
        entityId: testLightEntityId,
        currentState,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setHaLightToggleStatus({ state: 'error', message });
    }
  };

  return (
    <div
      className="mt-8 rounded-lg border-2 border-blue-500/30 bg-blue-50 p-4 dark:bg-blue-900/20"
      style={{ backgroundColor: 'blue' }}
    >
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

      {showHaSmokeTest && (
        <div className="mt-4 rounded bg-white p-3 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Home Assistant Connection
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Smoke test: connect, fetch states and services.
              </p>
            </div>

            <button
              type="button"
              onClick={runHaSmokeTest}
              disabled={haTestStatus.state === 'running'}
              className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Run Home Assistant connection smoke test"
            >
              {haTestStatus.state === 'running' ? 'Testing…' : 'Test Connection'}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-700 dark:text-gray-200" aria-live="polite">
            {haTestStatus.state === 'idle' && <span>Not run yet.</span>}
            {haTestStatus.state === 'running' && <span>Connecting…</span>}
            {haTestStatus.state === 'success' && (
              <span>
                Connected. States: {haTestStatus.statesCount}. Service domains:{' '}
                {haTestStatus.servicesDomainsCount}.
              </span>
            )}
            {haTestStatus.state === 'error' && (
              <span className="text-red-600 dark:text-red-400">Error: {haTestStatus.message}</span>
            )}
          </div>

          <div className="bg-panel-border my-3 h-px" />

          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Light Toggle Test
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Toggle a single light entity to validate call_service.
              </p>
            </div>

            <button
              type="button"
              onClick={runHaLightToggleTest}
              disabled={haLightToggleStatus.state === 'running'}
              className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Toggle ${testLightEntityId} via Home Assistant`}
            >
              {haLightToggleStatus.state === 'running'
                ? 'Toggling…'
                : `Toggle ${testLightEntityId}`}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-700 dark:text-gray-200" aria-live="polite">
            {haLightToggleStatus.state === 'idle' && <span>Not run yet.</span>}
            {haLightToggleStatus.state === 'running' && <span>Toggling…</span>}
            {haLightToggleStatus.state === 'success' && (
              <span>
                Toggled {haLightToggleStatus.entityId}. Current state:{' '}
                {haLightToggleStatus.currentState}.
              </span>
            )}
            {haLightToggleStatus.state === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                Error: {haLightToggleStatus.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
