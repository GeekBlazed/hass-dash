import { lazy } from 'react';

import type { IOverlay } from '../../../interfaces/IOverlay';

const LazyTrackedDeviceMarkersBridge = lazy(() =>
  import('./TrackedDeviceMarkersBridge').then((m) => ({ default: m.TrackedDeviceMarkersBridge }))
);

const LazyHaAreaClimateOverlayBridge = lazy(() =>
  import('../HaAreaClimateOverlayBridge').then((m) => ({ default: m.HaAreaClimateOverlayBridge }))
);

const LazyHaRoomLightingOverlayBridge = lazy(() =>
  import('./HaRoomLightingOverlayBridge').then((m) => ({ default: m.HaRoomLightingOverlayBridge }))
);

export const OVERLAYS: ReadonlyArray<IOverlay> = [
  {
    id: 'tracking',
    label: 'Tracking',
    renderer: 'svg',
    Component: LazyTrackedDeviceMarkersBridge,
  },
  {
    id: 'climate',
    label: 'Climate',
    renderer: 'svg',
    Component: LazyHaAreaClimateOverlayBridge,
  },
  {
    id: 'lighting',
    label: 'Lighting',
    renderer: 'svg',
    Component: LazyHaRoomLightingOverlayBridge,
  },
];

export function getOverlayDefinitions(): ReadonlyArray<Pick<IOverlay, 'id' | 'label'>> {
  return OVERLAYS.map(({ id, label }) => ({ id, label }));
}
