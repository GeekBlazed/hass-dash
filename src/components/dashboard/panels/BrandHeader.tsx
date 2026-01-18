import { useDevToolsStore } from '../../../stores/useDevToolsStore';
import { PwaInstallButton } from '../../pwa/PwaInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

export function BrandHeader() {
  const isDevelopment = import.meta.env.DEV;
  const debugPanelOpen = useDevToolsStore((s) => s.debugPanelOpen);
  const toggleDebugPanel = useDevToolsStore((s) => s.toggleDebugPanel);

  return (
    <div className="brand">
      {isDevelopment ? (
        <button
          type="button"
          className={debugPanelOpen ? 'brand-action is-active' : 'brand-action'}
          aria-label="Toggle debug panel"
          aria-pressed={debugPanelOpen}
          onClick={toggleDebugPanel}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.11-.2-.35-.28-.57-.2l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.488.488 0 0 0 13.94 1h-3.88c-.24 0-.44.17-.48.41l-.36 2.54c-.59.23-1.13.54-1.63.94l-2.39-.96c-.22-.09-.46 0-.57.2L2.71 7.45c-.11.2-.06.46.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.11.2.35.28.57.2l2.39-.96c.5.4 1.04.71 1.63.94l.36 2.54c.04.24.24.41.48.41h3.88c.24 0 .44-.17.48-.41l.36-2.54c.59-.23 1.13-.54 1.63-.94l2.39.96c.22.09.46 0 .57-.2l1.92-3.32c.11-.2.06-.46-.12-.61l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
            />
          </svg>
        </button>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M10.5 20v-6h3v6h4.5v-8h2L12 3 1 12h2v8z" />
        </svg>
      )}
      <div className="title">Home</div>
      <OfflineIndicator />
      <PwaInstallButton />
    </div>
  );
}
