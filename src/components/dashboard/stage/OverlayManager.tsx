import { Suspense, useMemo } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { OVERLAYS } from './overlayDefinitions';

export function OverlayManager({ renderer }: { renderer: 'svg' }) {
  const enabledOverlays = useDashboardStore((s) => s.overlays);

  const overlaysToRender = useMemo(
    () => OVERLAYS.filter((o) => o.renderer === renderer && enabledOverlays[o.id]),
    [enabledOverlays, renderer]
  );

  return (
    <Suspense fallback={null}>
      {overlaysToRender.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </Suspense>
  );
}
