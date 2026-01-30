import { Icon } from '@iconify/react';
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
          <Icon
            icon="mdi:settings"
            aria-hidden="true"
            data-testid="settings-icon"
            className="settings-icon"
          />
        </button>
      ) : (
        <Icon
          icon="mdi:home-circle"
          aria-hidden="true"
          data-testid="home-icon"
          className="home-icon"
        />
      )}
      <div className="title">Home</div>
      <OfflineIndicator />
      <PwaInstallButton />
    </div>
  );
}
