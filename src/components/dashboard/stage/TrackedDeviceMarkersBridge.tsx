import { useEffect } from 'react';

import {
  getTrackingDebugOverlayMode,
  type TrackingDebugOverlayMode,
} from '../../../features/tracking/trackingDebugOverlayConfig';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import type { DeviceLocation } from '../../../stores/useDeviceLocationStore';
import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../../stores/useDeviceTrackerMetadataStore';

const SVG_NS = 'http://www.w3.org/2000/svg';

const TRACKING_ATTR = 'data-hass-dash-tracking';
const ENTITY_ID_ATTR = 'data-entity-id';
const DEVICE_ID_ATTR = 'data-device-id';
const TRACKING_KIND_ATTR = 'data-hass-dash-tracking-kind';
const ORIG_TRANSFORM_ATTR = 'data-hass-dash-orig-transform';
const DEBUG_LABEL_ATTR = 'data-hass-dash-tracking-debug';

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

const getPreferredDeviceLabel = (
  entityId: string,
  metadataByEntityId: Record<string, { name?: string; alias?: string }>
): string => {
  const meta = metadataByEntityId[entityId];
  const name = meta?.name?.trim();
  if (name) return name;
  const alias = meta?.alias?.trim();
  if (alias) return alias;
  return getDeviceLabel(entityId);
};

const computeInitials = (name: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const parts = trimmed
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return undefined;

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const firstChar = first[0] ?? '';
  const lastChar = last ? (last[0] ?? '') : '';

  const initials = `${firstChar}${lastChar}`.trim().toUpperCase();
  return initials || undefined;
};

const upsertAvatar = (
  marker: SVGGElement,
  avatarUrl: string | undefined,
  initials: string | undefined
): void => {
  let image = marker.querySelector<SVGImageElement>('image.device-avatar-image');
  let text = marker.querySelector<SVGTextElement>('text.device-avatar-text');

  if (!image) {
    image = createSvgElement('image');
    image.setAttribute('class', 'device-avatar-image');
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '1');
    image.setAttribute('height', '1');
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    // Clip to a circle; sized relative to the image box.
    const clipId = `hass-dash-avatar-clip-${
      marker.getAttribute(ENTITY_ID_ATTR) ?? Math.random().toString(36).slice(2)
    }`;

    const defs = createSvgElement('defs');
    const clipPath = createSvgElement('clipPath');
    clipPath.setAttribute('id', clipId);
    clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
    const circle = createSvgElement('circle');
    circle.setAttribute('cx', '0.5');
    circle.setAttribute('cy', '0.5');
    circle.setAttribute('r', '0.5');
    clipPath.appendChild(circle);
    defs.appendChild(clipPath);
    marker.appendChild(defs);

    image.setAttribute('clip-path', `url(#${clipId})`);

    // Place above the pin but below the label.
    const label = marker.querySelector('text.device-label');
    if (label && label.parentNode === marker) {
      marker.insertBefore(image, label);
    } else {
      marker.appendChild(image);
    }
  }

  if (!text) {
    text = createSvgElement('text');
    text.setAttribute('class', 'device-avatar-text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '0');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('pointer-events', 'none');

    const label = marker.querySelector('text.device-label');
    if (label && label.parentNode === marker) {
      marker.insertBefore(text, label);
    } else {
      marker.appendChild(text);
    }
  }

  if (avatarUrl) {
    image.setAttribute('href', avatarUrl);
    image.setAttribute('xlink:href', avatarUrl);
    image.removeAttribute('display');

    text.setAttribute('display', 'none');
    if (text.textContent) text.textContent = '';
    return;
  }

  // No avatar: hide the image and show initials.
  image.removeAttribute('href');
  image.removeAttribute('xlink:href');
  image.setAttribute('display', 'none');

  const desired = (initials ?? '').trim().toUpperCase();
  if (desired) {
    text.removeAttribute('display');
    if (text.textContent !== desired) {
      text.textContent = desired;
    }
  } else {
    text.setAttribute('display', 'none');
    if (text.textContent) text.textContent = '';
  }
};

const getMarkerIdsForEntityId = (entityId: string): string[] => {
  // Prefer exact match (your `devices.yaml` uses full HA entity ids like
  // `device_tracker.phone_jeremy`). Fall back to just `object_id` for legacy.
  const objectId = getDeviceLabel(entityId);
  return objectId !== entityId ? [entityId, objectId] : [entityId];
};

const formatNumberCompact = (value: number): string => {
  if (!Number.isFinite(value)) return String(value);
  // Keep this compact for the overlay; the point is glanceable debugging.
  return value.toFixed(2);
};

const formatDebugLabelLines = (
  location: DeviceLocation,
  mode: TrackingDebugOverlayMode
): string[] => {
  const confidence = location.confidence;
  const lastSeen = location.lastSeen ?? '-';

  if (mode === 'geo') {
    const lat = location.geo?.latitude;
    const lon = location.geo?.longitude;
    const ele = location.geo?.elevation;

    const geoLine =
      lat !== undefined && lon !== undefined
        ? `lat=${formatNumberCompact(lat)} lon=${formatNumberCompact(lon)}${
            ele === undefined ? '' : ` ele=${formatNumberCompact(ele)}`
          }`
        : 'lat=- lon=-';

    return [geoLine, `conf=${confidence}`, `last_seen=${lastSeen}`];
  }

  const { x, y, z } = location.position;
  const xyzLine = `x=${formatNumberCompact(x)} y=${formatNumberCompact(y)}${
    z === undefined ? '' : ` z=${formatNumberCompact(z)}`
  }`;
  return [xyzLine, `conf=${confidence}`, `last_seen=${lastSeen}`];
};

const upsertDebugLabel = (
  marker: SVGGElement,
  lines: string[] | null,
  mode: TrackingDebugOverlayMode
): void => {
  const existing = marker.querySelector<SVGTextElement>(`text[${DEBUG_LABEL_ATTR}="true"]`);
  if (!lines || lines.length === 0) {
    existing?.remove();
    return;
  }

  const el = existing ?? createSvgElement('text');
  if (!existing) {
    el.setAttribute(DEBUG_LABEL_ATTR, 'true');
    el.setAttribute('class', 'device-debug-label');
    el.setAttribute('x', '0.9');
    el.setAttribute('y', mode === 'geo' ? '-0.9' : '-0.7');
    el.setAttribute('text-anchor', 'start');
    el.setAttribute('dominant-baseline', 'hanging');
    el.setAttribute('font-size', '0.22');
    el.setAttribute('fill', 'var(--text-muted)');
    el.setAttribute('pointer-events', 'none');
    marker.appendChild(el);
  }

  while (el.firstChild) el.removeChild(el.firstChild);

  lines.forEach((line, index) => {
    const tspan = createSvgElement('tspan');
    tspan.setAttribute('x', '0.9');
    tspan.setAttribute('dy', index === 0 ? '0' : '1.1em');
    tspan.textContent = line;
    el.appendChild(tspan);
  });
};

const syncMarkers = (
  layer: SVGGElement,
  isEnabled: boolean,
  locationsByEntityId: Record<string, DeviceLocation>,
  metadataByEntityId: Record<
    string,
    { name?: string; alias?: string; avatarUrl?: string; initials?: string }
  >,
  showDebugOverlay: boolean,
  debugMode: TrackingDebugOverlayMode
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
      upsertDebugLabel(marker, null, debugMode);

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
      upsertDebugLabel(marker, null, debugMode);

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
        label.textContent = getPreferredDeviceLabel(entityId, metadataByEntityId);
        marker.appendChild(label);

        layer.appendChild(marker);
      }
    }

    // Keep labels up-to-date (both created and prototype-bound markers).
    const preferredLabel = getPreferredDeviceLabel(entityId, metadataByEntityId);
    const labelEl = marker.querySelector<SVGTextElement>('text.device-label');
    if (labelEl && labelEl.textContent !== preferredLabel) {
      labelEl.textContent = preferredLabel;
    }

    const meta = metadataByEntityId[entityId];
    const avatarUrl = meta?.avatarUrl;
    const initials = meta?.initials?.trim() || computeInitials(preferredLabel);
    upsertAvatar(marker, avatarUrl, initials);

    marker.setAttribute('transform', `translate(${x} ${yRender})`);

    if (showDebugOverlay) {
      upsertDebugLabel(marker, formatDebugLabelLines(location, debugMode), debugMode);
    } else {
      upsertDebugLabel(marker, null, debugMode);
    }
  }
};

export function TrackedDeviceMarkersBridge() {
  const { isEnabled } = useFeatureFlag('DEVICE_TRACKING');
  const { isEnabled: debugOverlayFlagEnabled } = useFeatureFlag('TRACKING_DEBUG_OVERLAY');
  const locationsByEntityId = useDeviceLocationStore((s) => s.locationsByEntityId);
  const metadataByEntityId = useDeviceTrackerMetadataStore((s) => s.metadataByEntityId);

  // Dev-only: never show this overlay in production builds.
  const showDebugOverlay = debugOverlayFlagEnabled && !import.meta.env.PROD;
  const debugMode = getTrackingDebugOverlayMode();

  useEffect(() => {
    const layer = getDevicesLayer();
    if (!layer) return;

    // Initial sync
    syncMarkers(
      layer,
      isEnabled,
      locationsByEntityId,
      metadataByEntityId,
      showDebugOverlay,
      debugMode
    );

    // scripts.js clears and re-renders the devices layer (e.g., during reload).
    // Observe child list changes so our tracked markers are re-applied promptly.
    const observer = new MutationObserver(() => {
      syncMarkers(
        layer,
        isEnabled,
        locationsByEntityId,
        metadataByEntityId,
        showDebugOverlay,
        debugMode
      );
    });

    observer.observe(layer, { childList: true });

    return () => {
      observer.disconnect();
    };
  }, [isEnabled, locationsByEntityId, metadataByEntityId, showDebugOverlay, debugMode]);

  return null;
}
