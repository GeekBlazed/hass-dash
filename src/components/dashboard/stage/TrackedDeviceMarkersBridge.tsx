import { useEffect } from 'react';

import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';

const SVG_NS = 'http://www.w3.org/2000/svg';

const TRACKING_ATTR = 'data-hass-dash-tracking';
const ENTITY_ID_ATTR = 'data-entity-id';
const DEVICE_ID_ATTR = 'data-device-id';
const TRACKING_KIND_ATTR = 'data-hass-dash-tracking-kind';
const ORIG_TRANSFORM_ATTR = 'data-hass-dash-orig-transform';

const createSvgElement = <T extends keyof SVGElementTagNameMap>(
  tag: T
): SVGElementTagNameMap[T] => {
  return document.createElementNS(SVG_NS, tag);
};

const getDevicesLayer = (): SVGGElement | null => {
  const el = document.getElementById('devices-layer');
  if (!el) return null;
  if (!(el instanceof SVGGElement)) return null;
  return el;
};

const readViewBoxRaw = (
  raw: string | null
): { x: number; y: number; w: number; h: number } | null => {
  if (!raw) return null;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map((v) => Number(v));
  if (parts.length !== 4) return null;
  const [x, y, w, h] = parts;
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return { x, y, w, h };
};

const readViewBox = (svg: SVGSVGElement): { x: number; y: number; w: number; h: number } | null => {
  // Prefer the prototype renderer's base viewBox (stable across pan/zoom).
  const base = readViewBoxRaw(svg.getAttribute('data-base-viewbox'));
  if (base) return base;

  // Fall back to the current viewBox.
  return readViewBoxRaw(svg.getAttribute('viewBox'));
};

const flipYIfPossible = (y: number): number => {
  const svg = document.getElementById('floorplan-svg');
  if (!(svg instanceof SVGSVGElement)) return y;

  const vb = readViewBox(svg);
  if (!vb) return y;

  // Mirror the prototype renderer: YAML coordinates treat +Y as north/up,
  // SVG increases +Y downward so we flip within the current viewBox.
  return 2 * vb.y + vb.h - y;
};

const getDeviceLabel = (entityId: string): string => {
  const parts = String(entityId).split('.');
  return parts.length > 1 ? parts[1] : entityId;
};

const getMarkerIdsForEntityId = (entityId: string): string[] => {
  // Prefer exact match (your `devices.yaml` uses full HA entity ids like
  // `device_tracker.phone_jeremy`). Fall back to just `object_id` for legacy.
  const objectId = getDeviceLabel(entityId);
  return objectId !== entityId ? [entityId, objectId] : [entityId];
};

const syncMarkers = (
  layer: SVGGElement,
  isEnabled: boolean,
  locationsByEntityId: Record<string, { position: { x: number; y: number } }>
): void => {
  const existingTrackingMarkers = new Map<string, SVGGElement>();
  layer.querySelectorAll<SVGGElement>(`g[${TRACKING_ATTR}="true"]`).forEach((marker) => {
    const entityId = marker.getAttribute(ENTITY_ID_ATTR);
    if (entityId) {
      existingTrackingMarkers.set(entityId, marker);
    }
  });

  if (!isEnabled) {
    for (const marker of existingTrackingMarkers.values()) {
      const kind = marker.getAttribute(TRACKING_KIND_ATTR);
      if (kind === 'bound') {
        const original = marker.getAttribute(ORIG_TRANSFORM_ATTR);
        if (original !== null) {
          if (original.length > 0) marker.setAttribute('transform', original);
          else marker.removeAttribute('transform');
        }

        marker.removeAttribute(TRACKING_ATTR);
        marker.removeAttribute(ENTITY_ID_ATTR);
        marker.removeAttribute(TRACKING_KIND_ATTR);
        marker.removeAttribute(ORIG_TRANSFORM_ATTR);
      } else {
        marker.remove();
      }
    }
    return;
  }

  const desiredEntityIds = new Set(Object.keys(locationsByEntityId));

  for (const [entityId, marker] of existingTrackingMarkers.entries()) {
    if (!desiredEntityIds.has(entityId)) {
      const kind = marker.getAttribute(TRACKING_KIND_ATTR);
      if (kind === 'bound') {
        const original = marker.getAttribute(ORIG_TRANSFORM_ATTR);
        if (original !== null) {
          if (original.length > 0) marker.setAttribute('transform', original);
          else marker.removeAttribute('transform');
        }

        marker.removeAttribute(TRACKING_ATTR);
        marker.removeAttribute(ENTITY_ID_ATTR);
        marker.removeAttribute(TRACKING_KIND_ATTR);
        marker.removeAttribute(ORIG_TRANSFORM_ATTR);
      } else {
        marker.remove();
      }
      existingTrackingMarkers.delete(entityId);
    }
  }

  for (const [entityId, location] of Object.entries(locationsByEntityId)) {
    const x = location.position.x;
    const y = location.position.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const yRender = flipYIfPossible(y);

    let marker = existingTrackingMarkers.get(entityId);
    if (!marker) {
      // Prefer updating an existing prototype-rendered marker when possible.
      const existing = getMarkerIdsForEntityId(entityId)
        .map((id) =>
          layer.querySelector<SVGGElement>(`g.device-marker[${DEVICE_ID_ATTR}="${CSS.escape(id)}"]`)
        )
        .find((el): el is SVGGElement => Boolean(el));

      if (existing) {
        marker = existing;
        marker.setAttribute(TRACKING_ATTR, 'true');
        marker.setAttribute(TRACKING_KIND_ATTR, 'bound');
        marker.setAttribute(ENTITY_ID_ATTR, entityId);
        if (marker.getAttribute(ORIG_TRANSFORM_ATTR) === null) {
          marker.setAttribute(ORIG_TRANSFORM_ATTR, marker.getAttribute('transform') ?? '');
        }
      } else {
        marker = createSvgElement('g');
        marker.setAttribute(TRACKING_ATTR, 'true');
        marker.setAttribute(TRACKING_KIND_ATTR, 'created');
        marker.setAttribute(ENTITY_ID_ATTR, entityId);
        marker.setAttribute(DEVICE_ID_ATTR, entityId);
        marker.setAttribute('class', 'device-marker device-marker--tracking');
        marker.setAttribute('aria-label', `Tracked device: ${entityId}`);

        const title = createSvgElement('title');
        title.textContent = `Tracked device: ${entityId}`;
        marker.appendChild(title);

        const use = createSvgElement('use');
        use.setAttribute('class', 'device-pin');
        use.setAttribute('href', '#devicePin');
        use.setAttribute('xlink:href', '#devicePin');
        use.setAttribute('x', '0');
        use.setAttribute('y', '0');
        use.setAttribute('width', '1');
        use.setAttribute('height', '1');
        marker.appendChild(use);

        const label = createSvgElement('text');
        label.setAttribute('class', 'device-label');
        label.setAttribute('x', '0');
        label.setAttribute('y', '0');
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'middle');
        label.textContent = getDeviceLabel(entityId);
        marker.appendChild(label);

        layer.appendChild(marker);
      }
    }

    marker.setAttribute('transform', `translate(${x} ${yRender})`);
  }
};

export function TrackedDeviceMarkersBridge() {
  const { isEnabled } = useFeatureFlag('DEVICE_TRACKING');
  const locationsByEntityId = useDeviceLocationStore((s) => s.locationsByEntityId);

  useEffect(() => {
    const layer = getDevicesLayer();
    if (!layer) return;

    // Initial sync
    syncMarkers(layer, isEnabled, locationsByEntityId);

    // scripts.js clears and re-renders the devices layer (e.g., during reload).
    // Observe child list changes so our tracked markers are re-applied promptly.
    const observer = new MutationObserver(() => {
      syncMarkers(layer, isEnabled, locationsByEntityId);
    });

    observer.observe(layer, { childList: true });

    return () => {
      observer.disconnect();
    };
  }, [isEnabled, locationsByEntityId]);

  return null;
}
