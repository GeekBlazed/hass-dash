import type { ComponentType, LazyExoticComponent } from 'react';

import type { DashboardOverlay } from '../stores/useDashboardStore';

export type OverlayRenderer = 'svg';

/**
 * UI overlay definition used by the floorplan renderer.
 *
 * This abstraction allows the overlay manager and toggle UI to work against a
 * stable contract (DIP) rather than concrete overlay component imports.
 */
export interface IOverlay {
  id: DashboardOverlay;
  label: string;
  renderer: OverlayRenderer;
  Component: ComponentType | LazyExoticComponent<ComponentType>;
}
