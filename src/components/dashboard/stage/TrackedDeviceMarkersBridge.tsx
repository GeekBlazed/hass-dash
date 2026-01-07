import { useEffect } from 'react';

import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';

const SVG_NS = 'http://www.w3.org/2000/svg';

const TRACKING_ATTR = 'data-hass-dash-tracking';
const ENTITY_ID_ATTR = 'data-entity-id';

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

export function TrackedDeviceMarkersBridge() {
  const { isEnabled } = useFeatureFlag('DEVICE_TRACKING');
  const locationsByEntityId = useDeviceLocationStore((s) => s.locationsByEntityId);

  useEffect(() => {
    const layer = getDevicesLayer();
    if (!layer) return;

    const existingMarkers = new Map<string, SVGGElement>();
    layer.querySelectorAll<SVGGElement>(`g[${TRACKING_ATTR}="true"]`).forEach((marker) => {
      const entityId = marker.getAttribute(ENTITY_ID_ATTR);
      if (entityId) {
        existingMarkers.set(entityId, marker);
      }
    });

    if (!isEnabled) {
      for (const marker of existingMarkers.values()) {
        marker.remove();
      }
      return;
    }

    const desiredEntityIds = new Set(Object.keys(locationsByEntityId));

    for (const [entityId, marker] of existingMarkers.entries()) {
      if (!desiredEntityIds.has(entityId)) {
        marker.remove();
        existingMarkers.delete(entityId);
      }
    }

    for (const [entityId, location] of Object.entries(locationsByEntityId)) {
      const x = location.position.x;
      const y = location.position.y;

      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      let marker = existingMarkers.get(entityId);
      if (!marker) {
        marker = createSvgElement('g');
        marker.setAttribute(TRACKING_ATTR, 'true');
        marker.setAttribute(ENTITY_ID_ATTR, entityId);
        marker.setAttribute('class', 'device-marker device-marker--tracking text-accent');

        const title = createSvgElement('title');
        title.textContent = `Tracked device: ${entityId}`;
        marker.appendChild(title);

        const use = createSvgElement('use');
        use.setAttribute('href', '#devicePin');
        use.setAttribute('x', '-0.35');
        use.setAttribute('y', '-0.7');
        use.setAttribute('width', '0.7');
        use.setAttribute('height', '0.7');
        marker.appendChild(use);

        layer.appendChild(marker);
      }

      marker.setAttribute('transform', `translate(${x} ${y})`);
    }
  }, [isEnabled, locationsByEntityId]);

  return null;
}
