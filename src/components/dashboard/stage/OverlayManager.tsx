import { Suspense } from 'react';

import { useDashboardStore } from '../../../stores/useDashboardStore';
import { OVERLAYS } from './overlayDefinitions';

export function OverlayManager({ renderer }: { renderer: 'svg' }) {
  const enabledOverlays = useDashboardStore((s) => s.overlays);

  return (
    <Suspense fallback={null}>
      {OVERLAYS.filter((o) => o.renderer === renderer && enabledOverlays[o.id]).map(
        ({ id, Component }) => (
          <Component key={id} />
        )
      )}
    </Suspense>
  );
}
