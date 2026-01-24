import { lazy, Suspense, useEffect, useState } from 'react';

import { TYPES } from '../../core/types';
import { useService } from '../../hooks/useService';
import type { IFloorplanDataSource } from '../../interfaces/IFloorplanDataSource';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardStage } from './DashboardStage';

const LazyDashboardControllers = lazy(() =>
  import('./DashboardControllers').then((m) => ({ default: m.DashboardControllers }))
);

export function DashboardShell() {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [shouldMountControllers, setShouldMountControllers] = useState(false);

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

  useEffect(() => {
    // Defer "side-effect" controllers (WebSocket, tracking, etc.) so the initial render
    // stays as small/fast as possible.
    //
    // This is a real-user win (smaller critical-path JS) and helps Lighthouse avoid
    // counting those chunks as unused JS during initial load.
    if (shouldMountControllers) return;

    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const mount = () => {
      setShouldMountControllers(true);
    };

    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(mount, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(mount, 750);
    }

    return () => {
      if (typeof idleId === 'number' && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [shouldMountControllers]);

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
      <Suspense fallback={null}>{shouldMountControllers && <LazyDashboardControllers />}</Suspense>
      <div className="frame" role="application" aria-label="Floorplan dashboard">
        <div className="app">
          <DashboardSidebar />
          <DashboardStage onRetryFloorplan={retryFloorplan} />
        </div>
      </div>
    </div>
  );
}
