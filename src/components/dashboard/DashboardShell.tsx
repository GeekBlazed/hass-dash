import { useEffect, useState } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IFloorplanDataSource } from '../../interfaces/IFloorplanDataSource';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { ConnectivityController } from './ConnectivityController';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardStage } from './DashboardStage';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';
import { HomeAssistantEntityStoreController } from './HomeAssistantEntityStoreController';

export function DashboardShell() {
  const [reloadNonce, setReloadNonce] = useState(0);

  const floorplanSource = useService<IFloorplanDataSource>(TYPES.IFloorplanDataSource);

  const setFloorplanLoading = useDashboardStore((s) => s.setFloorplanLoading);
  const setFloorplanLoaded = useDashboardStore((s) => s.setFloorplanLoaded);
  const setFloorplanError = useDashboardStore((s) => s.setFloorplanError);

  useEffect(() => {
    let disposed = false;

    if (typeof fetch !== 'function') {
      setFloorplanError('Fetch API is not available in this environment.');
      return;
    }

    setFloorplanLoading();

    void (async () => {
      const [floorplan] = await Promise.allSettled([floorplanSource.getFloorplan()]);

      if (disposed) return;

      if (floorplan.status === 'fulfilled') {
        setFloorplanLoaded(floorplan.value);
      } else {
        const message =
          floorplan.reason instanceof Error
            ? floorplan.reason.message
            : 'Failed to load floorplan.';
        setFloorplanError(message);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [reloadNonce, floorplanSource, setFloorplanLoading, setFloorplanLoaded, setFloorplanError]);

  const retryFloorplan = () => {
    setReloadNonce((n) => n + 1);
  };

  const virtualPanelEnv = import.meta.env.VITE_FEATURE_SHOW_VIRTUAL_PANEL;
  const virtualPanelEnabled = virtualPanelEnv !== 'false';
  if (typeof virtualPanelEnv !== 'undefined') {
    console.info(
      '[DEPRECATION WARNING] The virtual panel feature is deprecated and will be removed in a future release.'
    );
  }

  const viewportClassName = `viewport${virtualPanelEnabled ? '' : ' no-virtual-panel'}`;

  return (
    <div className={viewportClassName}>
      <HaLightHotwireBridge />
      <ConnectivityController />
      <HomeAssistantEntityStoreController />
      <DeviceLocationTrackingController />
      <div className="frame" role="application" aria-label="Floorplan dashboard">
        <div className="app">
          <DashboardSidebar />
          <DashboardStage onRetryFloorplan={retryFloorplan} />
        </div>
      </div>
    </div>
  );
}
