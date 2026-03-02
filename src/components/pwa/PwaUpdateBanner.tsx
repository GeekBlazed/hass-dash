import { useState, useSyncExternalStore } from 'react';

import { getAppVersion } from '../../pwa/appVersion';
import { updatePromptStore } from '../../pwa/updatePromptStore';

export function PwaUpdateBanner(): React.ReactElement | null {
  const state = useSyncExternalStore(
    updatePromptStore.subscribe,
    updatePromptStore.getSnapshot,
    updatePromptStore.getSnapshot
  );

  const [isApplying, setIsApplying] = useState(false);

  if (!state.isVisible || !state.applyUpdate) return null;

  const onReload = async () => {
    const applyUpdate = state.applyUpdate;
    if (!applyUpdate) return;

    setIsApplying(true);
    try {
      await applyUpdate();
    } finally {
      setIsApplying(false);
    }
  };

  const onLater = () => {
    if (isApplying) return;
    updatePromptStore.hide();
  };

  return (
    <div className="fixed right-4 bottom-4 left-4 z-50 sm:left-auto sm:w-[30rem]">
      <section
        className="border-panel-border bg-panel-card text-text-primary rounded-xl border p-4 shadow-lg"
        role="status"
        aria-live="polite"
        aria-label="App update available"
      >
        <p className="text-sm font-semibold">Update available</p>
        <p className="text-text-secondary mt-1 text-sm">
          A new version is ready. Reload to update.
        </p>
        <p className="text-text-muted mt-1 text-xs">Current version: v{getAppVersion()}</p>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onLater}
            className="border-panel-border-light bg-panel-surface text-text-secondary hover:bg-panel-bg rounded-md border px-3 py-1.5 text-sm transition-colors"
            disabled={isApplying}
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void onReload()}
            className="bg-accent text-panel-bg hover:bg-accent-light rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            disabled={isApplying}
          >
            {isApplying ? 'Updating…' : 'Reload'}
          </button>
        </div>
      </section>
    </div>
  );
}
