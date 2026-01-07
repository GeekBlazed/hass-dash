import { useEffect, useState } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IClimateDataSource } from '../../interfaces/IClimateDataSource';
import type { IFloorplanDataSource } from '../../interfaces/IFloorplanDataSource';
import type { ILightingDataSource } from '../../interfaces/ILightingDataSource';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardStage } from './DashboardStage';
import { DeviceLocationTrackingController } from './DeviceLocationTrackingController';
import { HaLightHotwireBridge } from './HaLightHotwireBridge';

export function DashboardShell() {
  const [reloadNonce, setReloadNonce] = useState(0);

  const floorplanSource = useService<IFloorplanDataSource>(TYPES.IFloorplanDataSource);
  const climateSource = useService<IClimateDataSource>(TYPES.IClimateDataSource);
  const lightingSource = useService<ILightingDataSource>(TYPES.ILightingDataSource);

  const setFloorplanLoading = useDashboardStore((s) => s.setFloorplanLoading);
  const setFloorplanLoaded = useDashboardStore((s) => s.setFloorplanLoaded);
  const setFloorplanError = useDashboardStore((s) => s.setFloorplanError);
  const setClimateModel = useDashboardStore((s) => s.setClimateModel);
  const setLightingModel = useDashboardStore((s) => s.setLightingModel);

  useEffect(() => {
    let disposed = false;

    if (typeof fetch !== 'function') {
      setFloorplanError('Fetch API is not available in this environment.');
      return;
    }

    setFloorplanLoading();

    void (async () => {
      const [floorplan, climate, lighting] = await Promise.allSettled([
        floorplanSource.getFloorplan(),
        climateSource.getClimate(),
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

      if (climate.status === 'fulfilled') {
        setClimateModel(climate.value);
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
    climateSource,
    lightingSource,
    setFloorplanLoading,
    setFloorplanLoaded,
    setFloorplanError,
    setClimateModel,
    setLightingModel,
  ]);

  const retryFloorplan = () => {
    setReloadNonce((n) => n + 1);
  };

  return (
    <div className="viewport">
      <HaLightHotwireBridge />
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
