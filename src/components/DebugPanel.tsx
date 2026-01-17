import { useEffect, useMemo, useState } from 'react';
import { container } from '../core/di-container';
import { TYPES } from '../core/types';
import type { IEntityService } from '../interfaces/IEntityService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import { useEntityStore } from '../stores/useEntityStore';
import type { HaStateChangedEventData } from '../types/home-assistant';

export function DebugPanel() {
  const homeAssistantClient = useMemo(
    () => container.get<IHomeAssistantClient>(TYPES.IHomeAssistantClient),
    []
  );

  const entityService = useMemo(() => container.get<IEntityService>(TYPES.IEntityService), []);

  const entitiesById = useEntityStore((s) => s.entitiesById);
  const setAllEntities = useEntityStore((s) => s.setAll);
  const upsertEntity = useEntityStore((s) => s.upsert);

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

  const isDevelopment = import.meta.env.DEV;

  const showHaSmokeTest = isDevelopment;
  const showEntityDebug = isDevelopment;

  const [entityDebugStatus, setEntityDebugStatus] = useState<
    | { state: 'idle' }
    | { state: 'running' }
    | { state: 'success'; count: number }
    | { state: 'error'; message: string }
  >({ state: 'idle' });
  const [entitySearch, setEntitySearch] = useState('');
  const [entityDomain, setEntityDomain] = useState<string>('');
  const [entityLiveEnabled, setEntityLiveEnabled] = useState(false);
  const [entityLiveSubscription, setEntityLiveSubscription] = useState<null | {
    unsubscribe: () => Promise<void>;
  }>(null);

  useEffect(() => {
    return () => {
      if (entityLiveSubscription) {
        void entityLiveSubscription.unsubscribe();
      }
    };
  }, [entityLiveSubscription]);

  const entityList = useMemo(() => {
    const all = Object.values(entitiesById);

    const domains = new Set<string>();
    for (const e of all) {
      const domain = e.entity_id.split('.')[0];
      if (domain) domains.add(domain);
    }

    const filteredByDomain = entityDomain
      ? all.filter((e) => e.entity_id.startsWith(`${entityDomain}.`))
      : all;

    const q = entitySearch.trim().toLowerCase();
    const filtered = q
      ? filteredByDomain.filter((e) => {
          const id = e.entity_id.toLowerCase();
          const friendly = String(
            (e.attributes as { friendly_name?: unknown })?.friendly_name ?? ''
          )
            .toLowerCase()
            .trim();
          return id.includes(q) || friendly.includes(q);
        })
      : filteredByDomain;

    const sorted = [...filtered].sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    const domainOptions = Array.from(domains).sort();

    return { sorted, domainOptions, totalCount: all.length };
  }, [entitiesById, entitySearch, entityDomain]);

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

  const loadEntities = async (): Promise<void> => {
    setEntityDebugStatus({ state: 'running' });

    try {
      const states = await entityService.fetchStates();
      setAllEntities(states);
      setEntityDebugStatus({ state: 'success', count: states.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setEntityDebugStatus({ state: 'error', message });
    }
  };

  const enableEntityLiveUpdates = async (): Promise<void> => {
    if (entityLiveEnabled) return;
    setEntityLiveEnabled(true);

    try {
      const subscription = await entityService.subscribeToStateChanges((next) => {
        upsertEntity(next);
      });

      setEntityLiveSubscription(subscription);
    } catch {
      setEntityLiveEnabled(false);
      setEntityLiveSubscription(null);
    }
  };

  const disableEntityLiveUpdates = async (): Promise<void> => {
    setEntityLiveEnabled(false);

    const subscription = entityLiveSubscription;
    setEntityLiveSubscription(null);

    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      className="mt-8 rounded-lg border-2 border-blue-500/30 bg-blue-50 p-4 dark:bg-blue-900/20"
      style={{ backgroundColor: 'blue' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">🛠️</span>
        <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">Dev Tools</h2>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Enable this panel with <code>?debug</code> in dev.
        </p>
      </div>

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

      {showEntityDebug && (
        <div className="mt-4 rounded bg-white p-3 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Entity Debug
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Load entities from REST and optionally live-update via WebSocket.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadEntities}
                disabled={entityDebugStatus.state === 'running'}
                className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Load Home Assistant entities"
              >
                {entityDebugStatus.state === 'running' ? 'Loading…' : 'Load'}
              </button>

              <button
                type="button"
                onClick={entityLiveEnabled ? disableEntityLiveUpdates : enableEntityLiveUpdates}
                className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Enable live entity updates"
              >
                {entityLiveEnabled ? 'Disable Live' : 'Enable Live'}
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-700 dark:text-gray-200" aria-live="polite">
            {entityDebugStatus.state === 'idle' && (
              <span>Not loaded yet. Cached entities: {entityList.totalCount}.</span>
            )}
            {entityDebugStatus.state === 'running' && <span>Loading…</span>}
            {entityDebugStatus.state === 'success' && (
              <span>Loaded {entityDebugStatus.count} entities.</span>
            )}
            {entityDebugStatus.state === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                Error: {entityDebugStatus.message}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-700 dark:text-gray-200">
              Search
              <input
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                aria-label="Search entities"
              />
            </label>

            <label className="text-xs text-gray-700 dark:text-gray-200">
              Domain
              <select
                value={entityDomain}
                onChange={(e) => setEntityDomain(e.target.value)}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                aria-label="Filter entity domain"
              >
                <option value="">All</option>
                {entityList.domainOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-xs text-gray-600 dark:text-gray-300">
              Showing {entityList.sorted.length} of {entityList.totalCount}
            </span>
          </div>

          <div className="mt-3 max-h-56 overflow-auto rounded border border-gray-200 dark:border-gray-700">
            {entityList.sorted.length === 0 ? (
              <div className="p-2 text-xs text-gray-600 dark:text-gray-300">No matches.</div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {entityList.sorted.map((e) => (
                  <li key={e.entity_id} className="flex items-center justify-between gap-2 p-2">
                    <code className="text-xs text-gray-800 dark:text-gray-100">{e.entity_id}</code>
                    <span className="text-xs text-gray-600 dark:text-gray-300">{e.state}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
