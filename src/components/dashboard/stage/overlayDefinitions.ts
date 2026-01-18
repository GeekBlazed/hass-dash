import type { IOverlay } from '../../../interfaces/IOverlay';
import { HaAreaClimateOverlayBridge } from '../HaAreaClimateOverlayBridge';
import { HaRoomLightingOverlayBridge } from './HaRoomLightingOverlayBridge';
import { TrackedDeviceMarkersBridge } from './TrackedDeviceMarkersBridge';

export const OVERLAYS: ReadonlyArray<IOverlay> = [
  {
    id: 'tracking',
    label: 'Tracking',
    renderer: 'svg',
    Component: TrackedDeviceMarkersBridge,
  },
  {
    id: 'climate',
    label: 'Climate',
    renderer: 'svg',
    Component: HaAreaClimateOverlayBridge,
  },
  {
    id: 'lighting',
    label: 'Lighting',
    renderer: 'svg',
    Component: HaRoomLightingOverlayBridge,
  },
];

export function getOverlayDefinitions(): ReadonlyArray<Pick<IOverlay, 'id' | 'label'>> {
  return OVERLAYS.map(({ id, label }) => ({ id, label }));
}
