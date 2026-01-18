import type { ComponentType } from 'react';

import type { DashboardOverlay } from '../../../stores/useDashboardStore';
import { HaAreaClimateOverlayBridge } from '../HaAreaClimateOverlayBridge';
import { HaRoomLightingOverlayBridge } from './HaRoomLightingOverlayBridge';
import { TrackedDeviceMarkersBridge } from './TrackedDeviceMarkersBridge';

export type OverlayDefinition = {
  id: DashboardOverlay;
  label: string;
  renderer: 'svg';
  Component: ComponentType;
};

export const OVERLAYS: ReadonlyArray<OverlayDefinition> = [
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

export function getOverlayDefinitions(): ReadonlyArray<Pick<OverlayDefinition, 'id' | 'label'>> {
  return OVERLAYS.map(({ id, label }) => ({ id, label }));
}
