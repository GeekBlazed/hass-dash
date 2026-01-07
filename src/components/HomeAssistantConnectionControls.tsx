import { useState } from 'react';

import { TYPES } from '../core/types';
import { useFeatureFlag } from '../hooks/useFeatureFlag';
import { useService } from '../hooks/useService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type {
  HomeAssistantConnectionConfig,
  IHomeAssistantConnectionConfig,
} from '../interfaces/IHomeAssistantConnectionConfig';
import { validateHomeAssistantConnectionConfig } from '../utils/homeAssistantConnectionValidation';
import { Button } from './ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/Dialog';

type TestStatus =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'success' }
  | { state: 'error'; message: string };

export function HomeAssistantConnectionControls(): React.ReactElement | null {
  const { isEnabled } = useFeatureFlag('HA_CONNECTION');
  const connectionConfig = useService<IHomeAssistantConnectionConfig>(
    TYPES.IHomeAssistantConnectionConfig
  );
  const homeAssistantClient = useService<IHomeAssistantClient>(TYPES.IHomeAssistantClient);

  const [draft, setDraft] = useState<HomeAssistantConnectionConfig>(() => {
    const cfg = connectionConfig.getConfig();
    return {
      baseUrl: cfg.baseUrl ?? '',
      webSocketUrl: cfg.webSocketUrl ?? '',
      accessToken: cfg.accessToken ?? '',
    };
  });

  const [testStatus, setTestStatus] = useState<TestStatus>({ state: 'idle' });

  const currentValidation = connectionConfig.validate();
  const draftValidation = validateHomeAssistantConnectionConfig(draft);

  if (!isEnabled) return null;

  const isDev = import.meta.env.DEV;

  const badgeText = currentValidation.isValid ? 'HA: Configured' : 'HA: Not configured';
  const badgeClassName = currentValidation.isValid
    ? 'text-success dark:text-success'
    : 'text-text-muted dark:text-text-muted';

  const save = (): void => {
    setTestStatus({ state: 'idle' });
    connectionConfig.setOverrides({
      baseUrl: draft.baseUrl,
      webSocketUrl: draft.webSocketUrl,
      accessToken: draft.accessToken,
    });

    const cfg = connectionConfig.getConfig();
    setDraft({
      baseUrl: cfg.baseUrl ?? '',
      webSocketUrl: cfg.webSocketUrl ?? '',
      accessToken: cfg.accessToken ?? '',
    });
  };

  const clear = (): void => {
    setTestStatus({ state: 'idle' });
    connectionConfig.clearOverrides();
    const cfg = connectionConfig.getConfig();
    setDraft({
      baseUrl: cfg.baseUrl ?? '',
      webSocketUrl: cfg.webSocketUrl ?? '',
      accessToken: cfg.accessToken ?? '',
    });
  };

  const testConnection = async (): Promise<void> => {
    setTestStatus({ state: 'running' });

    try {
      if (!draftValidation.isValid) {
        setTestStatus({
          state: 'error',
          message: draftValidation.errors[0] ?? 'Invalid configuration',
        });
        return;
      }

      // Avoid mutating global overrides during a connection test.
      // In dev, prefer testing the draft values directly if supported by the client.
      if (isDev && homeAssistantClient.connectWithConfig) {
        await homeAssistantClient.connectWithConfig(draft);
      } else {
        await homeAssistantClient.connect();
      }
      setTestStatus({ state: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setTestStatus({ state: 'error', message });
    } finally {
      homeAssistantClient.disconnect();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-medium ${badgeClassName}`} aria-label={badgeText}>
        {badgeText}
      </span>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open Home Assistant connection settings"
            iconBefore={
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.983 13.5a1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5 1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.1 12a8.1 8.1 0 0 0-.13-1.44l2.01-1.56-1.92-3.32-2.44.99a8.38 8.38 0 0 0-2.5-1.44L14.76 2h-3.84L9.88 5.23a8.38 8.38 0 0 0-2.5 1.44l-2.44-.99L3.02 9l2.01 1.56A8.1 8.1 0 0 0 4.9 12c0 .49.04.97.13 1.44L3.02 15l1.92 3.32 2.44-.99a8.38 8.38 0 0 0 2.5 1.44L10.92 22h3.84l1.04-3.23a8.38 8.38 0 0 0 2.5-1.44l2.44.99L22.02 15l-2.01-1.56c.09-.47.13-.95.13-1.44Z"
                />
              </svg>
            }
          >
            HA
          </Button>
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Home Assistant Connection</DialogTitle>
            <DialogDescription>
              Configure the Home Assistant endpoint and token. In production, these values come from
              environment variables.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="ha-base-url"
                className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Base URL
              </label>
              <input
                id="ha-base-url"
                value={draft.baseUrl ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://homeassistant.local:8123"
                disabled={!isDev}
                className="focus:border-primary focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used to derive WebSocket URL if not provided.
              </p>
            </div>

            <div>
              <label
                htmlFor="ha-ws-url"
                className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                WebSocket URL (optional)
              </label>
              <input
                id="ha-ws-url"
                value={draft.webSocketUrl ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, webSocketUrl: e.target.value }))}
                placeholder="wss://homeassistant.local:8123/api/websocket"
                disabled={!isDev}
                className="focus:border-primary focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="ha-token"
                className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Access Token
              </label>
              <input
                id="ha-token"
                type="password"
                value={draft.accessToken ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, accessToken: e.target.value }))}
                placeholder="long-lived access token"
                disabled={!isDev}
                className="focus:border-primary focus:ring-primary/30 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Stored in sessionStorage for dev overrides only.
              </p>
            </div>

            {!isDev && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Runtime overrides are disabled in production.
              </p>
            )}

            {!draftValidation.isValid && (
              <div className="text-xs text-gray-700 dark:text-gray-200" aria-live="polite">
                <div className="font-semibold">Validation</div>
                <ul className="list-disc pl-5">
                  {draftValidation.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-gray-700 dark:text-gray-200" aria-live="polite">
              {testStatus.state === 'idle' && <span>Connection test not run.</span>}
              {testStatus.state === 'running' && <span>Testing connection…</span>}
              {testStatus.state === 'success' && (
                <span className="text-success dark:text-success">Connected successfully.</span>
              )}
              {testStatus.state === 'error' && (
                <span className="text-danger dark:text-danger">Error: {testStatus.message}</span>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={testConnection}
              loading={testStatus.state === 'running'}
            >
              Test
            </Button>
            <Button type="button" variant="secondary" onClick={clear} disabled={!isDev}>
              Clear
            </Button>
            <Button type="button" onClick={save} disabled={!isDev}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
