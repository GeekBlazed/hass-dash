import { useEffect, useState } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IFloorplanDataSource } from '../../interfaces/IFloorplanDataSource';
import type { ILightingDataSource } from '../../interfaces/ILightingDataSource';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardStage } from './DashboardStage';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';
import { HaAreaClimateOverlayBridge } from './HaAreaClimateOverlayBridge';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';
import { HomeAssistantEntityStoreController } from './HomeAssistantEntityStoreController';
import { HaRoomLightingOverlayBridge } from './stage/HaRoomLightingOverlayBridge';

export function DashboardShell() {
  const [reloadNonce, setReloadNonce] = useState(0);

  const floorplanSource = useService<IFloorplanDataSource>(TYPES.IFloorplanDataSource);
  const lightingSource = useService<ILightingDataSource>(TYPES.ILightingDataSource);

  const setFloorplanLoading = useDashboardStore((s) => s.setFloorplanLoading);
  const setFloorplanLoaded = useDashboardStore((s) => s.setFloorplanLoaded);
  const setFloorplanError = useDashboardStore((s) => s.setFloorplanError);
  const setLightingModel = useDashboardStore((s) => s.setLightingModel);

  useEffect(() => {
    let disposed = false;

    if (typeof fetch !== 'function') {
      setFloorplanError('Fetch API is not available in this environment.');
      return;
    }

    setFloorplanLoading();

    void (async () => {
      const [floorplan, lighting] = await Promise.allSettled([
        floorplanSource.getFloorplan(),
        lightingSource.getLighting(),
      ]);

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

      if (lighting.status === 'fulfilled') {
        setLightingModel(lighting.value);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    reloadNonce,
    floorplanSource,
    lightingSource,
    setFloorplanLoading,
    setFloorplanLoaded,
    setFloorplanError,
    setLightingModel,
  ]);

  const retryFloorplan = () => {
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="viewport">
      <HaLightHotwireBridge />
      <HaAreaClimateOverlayBridge />
      <HaRoomLightingOverlayBridge />
      <HomeAssistantEntityStoreController />
      <DeviceLocationTrackingController />
      <div className="frame" role="application" aria-label="Floorplan prototype">
        <div className="app">
          <DashboardSidebar />
          <DashboardStage onRetryFloorplan={retryFloorplan} />
        </div>
      </div>
    </div>
  );
}
