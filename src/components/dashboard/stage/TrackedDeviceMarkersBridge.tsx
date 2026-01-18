import { useEffect, useState } from 'react';

import {
  getTrackingDebugOverlayMode,
  type TrackingDebugOverlayMode,
} from '../../../features/tracking/trackingDebugOverlayConfig';
import { getTrackingShowConfidenceWhenLessThan } from '../../../features/tracking/trackingShowConfidenceConfig';
import { getTrackingStaleTimeoutMs } from '../../../features/tracking/trackingStaleTimeoutConfig';
import { getTrackingStaleWarningMs } from '../../../features/tracking/trackingStaleWarningConfig';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import type { DeviceLocation } from '../../../stores/useDeviceLocationStore';
import { useDeviceLocationStore } from '../../../stores/useDeviceLocationStore';
import { useDeviceTrackerMetadataStore } from '../../../stores/useDeviceTrackerMetadataStore';
import { computeInitials } from '../../../utils/deviceLocationTracking';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Keep in sync with the SVG renderer sizing.
// This avoids a “first draw” flash where markers are created after the
// sizing pass and would otherwise render with default (very large) SVG text sizes.
const DEVICE_PIN_SCALE = 3.15;

const TRACKING_ATTR = 'data-hass-dash-tracking';
const ENTITY_ID_ATTR = 'data-entity-id';
const DEVICE_ID_ATTR = 'data-device-id';
const TRACKING_KIND_ATTR = 'data-hass-dash-tracking-kind';
const ORIG_TRANSFORM_ATTR = 'data-hass-dash-orig-transform';
const DEBUG_LABEL_ATTR = 'data-hass-dash-tracking-debug';
const STALE_LABEL_ATTR = 'data-hass-dash-tracking-stale';

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
  // Prefer the floorplan renderer's base viewBox (stable across pan/zoom).
  const base = readViewBoxRaw(svg.getAttribute('data-base-viewbox'));
  if (base) return base;

  // Fall back to the current viewBox.
  return readViewBoxRaw(svg.getAttribute('viewBox'));
};

const readUnitsPerPx = (): number | null => {
  const svg = document.getElementById('floorplan-svg');
  if (!(svg instanceof SVGSVGElement)) return null;

  const rect = svg.getBoundingClientRect();
  if (!rect.width) return null;

  // For sizing, we must use the *current* viewBox so markers stay the same
  // on-screen size during zooming.
  // Fall back to the base viewBox only if the current viewBox is missing.
  const current = readViewBoxRaw(svg.getAttribute('viewBox'));
  const vb = current ?? readViewBox(svg);
  if (!vb?.w) return null;

  return vb.w / rect.width;
};

const applyMarkerSizing = (marker: SVGGElement, unitsPerPx: number): void => {
  // Match sizing rules.
  const devicePinHeightInUserUnits = 34 * DEVICE_PIN_SCALE * unitsPerPx;
  const devicePinWidthInUserUnits = 26 * DEVICE_PIN_SCALE * unitsPerPx;
  const deviceLabelGapInUserUnits = 6 * DEVICE_PIN_SCALE * unitsPerPx;
  const deviceLabelFontSizeInUserUnits = 11 * unitsPerPx;

  const use = marker.querySelector<SVGUseElement>('use.device-pin');
  if (use) {
    use.setAttribute('width', String(devicePinWidthInUserUnits));
    use.setAttribute('height', String(devicePinHeightInUserUnits));
    use.setAttribute('x', String(-devicePinWidthInUserUnits / 2));
    use.setAttribute('y', String(-devicePinHeightInUserUnits));
  }

  const label = marker.querySelector<SVGTextElement>('text.device-label');
  if (label) {
    const labelFontSize = deviceLabelFontSizeInUserUnits * 1.35;
    label.setAttribute('font-size', String(labelFontSize));
    label.setAttribute('x', '0');
    label.setAttribute('y', String(-devicePinHeightInUserUnits - deviceLabelGapInUserUnits / 4));

    // Status label (stale minutes OR low confidence) should sit just beneath the pin,
    // and be scaled relative to the main label for consistent readability.
    const status = marker.querySelector<SVGTextElement>(`text[${STALE_LABEL_ATTR}="true"]`);
    if (status) {
      status.setAttribute('font-size', String(labelFontSize * 0.8));
      status.setAttribute('x', '0');
      // Move up ~one text line for tighter grouping.
      status.setAttribute('y', String(-9 * unitsPerPx));
    }
  }

  // Avatar/initials overlay within the pin head.
  const avatarSizeInUserUnits = devicePinWidthInUserUnits * 0.54 + 2 * unitsPerPx;
  const avatarCenterY =
    -devicePinHeightInUserUnits + devicePinHeightInUserUnits * 0.375 + 4 * unitsPerPx;

  const avatarImage = marker.querySelector<SVGImageElement>('image.device-avatar-image');
  if (avatarImage) {
    avatarImage.setAttribute('width', String(avatarSizeInUserUnits));
    avatarImage.setAttribute('height', String(avatarSizeInUserUnits));
    avatarImage.setAttribute('x', String(-avatarSizeInUserUnits / 2));
    avatarImage.setAttribute('y', String(avatarCenterY - avatarSizeInUserUnits / 2));
  }

  const avatarText = marker.querySelector<SVGTextElement>('text.device-avatar-text');
  if (avatarText) {
    avatarText.setAttribute('font-size', String(avatarSizeInUserUnits * 0.42));
    avatarText.setAttribute('x', '0');
    avatarText.setAttribute('y', String(avatarCenterY));
  }
};

const flipYIfPossible = (y: number): number => {
  const svg = document.getElementById('floorplan-svg');
  if (!(svg instanceof SVGSVGElement)) return y;

  const vb = readViewBox(svg);
  if (!vb) return y;

  // YAML coordinates treat +Y as north/up,
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

const PREFETCHED_AVATAR_URLS_LIMIT = 200;
const prefetchedAvatarUrls = new Set<string>();

const prefetchAvatarUrl = (avatarUrl: string): void => {
  const url = avatarUrl.trim();
  if (!url) return;

  // SSR/tests safety: only prefetch when the browser Image API exists.
  if (typeof Image === 'undefined') return;

  if (prefetchedAvatarUrls.has(url)) return;

  // Bound memory: if we somehow see lots of avatars, prefer clearing vs. unbounded growth.
  if (prefetchedAvatarUrls.size >= PREFETCHED_AVATAR_URLS_LIMIT) {
    prefetchedAvatarUrls.clear();
  }

  prefetchedAvatarUrls.add(url);

  try {
    const img = new Image();
    // Hint that decoding doesn't need to block paint.
    img.decoding = 'async';
    img.src = url;
  } catch {
    // Best-effort only.
  }
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
    prefetchAvatarUrl(avatarUrl);
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
  // Prefer exact match (full HA entity ids like `device_tracker.phone_jeremy`).
  // Fall back to just `object_id` for legacy.
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

const upsertStatusLabel = (marker: SVGGElement, text: string | null): void => {
  const existing = marker.querySelector<SVGTextElement>(`text[${STALE_LABEL_ATTR}="true"]`);
  if (!text) {
    existing?.remove();
    return;
  }

  const el = existing ?? createSvgElement('text');
  if (!existing) {
    el.setAttribute(STALE_LABEL_ATTR, 'true');
    el.setAttribute('class', 'device-stale-label');
    el.setAttribute('x', '0');
    // The marker's origin is the pin tip; keep this label just beneath it.
    // (Will be overridden by applyMarkerSizing when unitsPerPx is available.)
    el.setAttribute('y', '0.25');
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'hanging');
    // Default size for environments without unitsPerPx (e.g., some tests).
    el.setAttribute('font-size', '0.32');
    el.setAttribute('pointer-events', 'none');
    marker.appendChild(el);
  }

  if (el.textContent !== text) {
    el.textContent = text;
  }
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
  debugMode: TrackingDebugOverlayMode,
  nowMs: number,
  staleWarningMs: number
): void => {
  const unitsPerPx = readUnitsPerPx();

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
      upsertStatusLabel(marker, null);
      marker.classList.remove('device-marker--stale');

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
      upsertStatusLabel(marker, null);
      marker.classList.remove('device-marker--stale');

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
    const ageMs = nowMs - location.receivedAt;
    const isStale = staleWarningMs > 0 && ageMs >= staleWarningMs;
    const ageMinutes = isStale ? Math.floor(ageMs / 60_000) : null;

    const x = location.position.x;
    const y = location.position.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const yRender = flipYIfPossible(y);

    let marker = existingTrackingMarkers.get(entityId);
    if (!marker) {
      // Prefer updating an existing SVG-defined marker when possible.
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

    // Keep labels up-to-date (both created and bound-to-existing markers).
    const preferredLabel = getPreferredDeviceLabel(entityId, metadataByEntityId);
    const labelEl = marker.querySelector<SVGTextElement>('text.device-label');
    if (labelEl && labelEl.textContent !== preferredLabel) {
      labelEl.textContent = preferredLabel;
    }

    const meta = metadataByEntityId[entityId];
    const avatarUrl = meta?.avatarUrl;
    const initials = meta?.initials?.trim() || computeInitials(preferredLabel);
    upsertAvatar(marker, avatarUrl, initials);

    // Ensure consistent sizing on first paint (especially when markers are created
    // after an earlier renderer sizing pass).
    if (unitsPerPx !== null) {
      applyMarkerSizing(marker, unitsPerPx);
    }

    if (isStale) {
      marker.classList.add('device-marker--stale');
    } else {
      marker.classList.remove('device-marker--stale');
    }

    const statusText = (() => {
      if (isStale && ageMinutes && ageMinutes > 0) {
        return `> ${ageMinutes} minutes`;
      }

      const confidence = location.confidence;
      if (!Number.isFinite(confidence)) return null;

      const threshold = getTrackingShowConfidenceWhenLessThan();
      if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;
      if (confidence >= threshold) return null;
      return `${Math.round(confidence)}%`;
    })();

    upsertStatusLabel(marker, statusText);

    marker.setAttribute('transform', `translate(${x} ${yRender})`);

    if (showDebugOverlay) {
      upsertDebugLabel(marker, formatDebugLabelLines(location, debugMode), debugMode);
    } else {
      upsertDebugLabel(marker, null, debugMode);
    }
  }
};

const filterNonStaleLocations = (
  locationsByEntityId: Record<string, DeviceLocation>,
  nowMs: number,
  staleTimeoutMs: number
): Record<string, DeviceLocation> => {
  const filtered: Record<string, DeviceLocation> = {};
  for (const [entityId, location] of Object.entries(locationsByEntityId)) {
    const ageMs = nowMs - location.receivedAt;
    if (ageMs > staleTimeoutMs) continue;
    filtered[entityId] = location;
  }
  return filtered;
};

const getNextStaleCheckDelayMs = (
  locationsByEntityId: Record<string, DeviceLocation>,
  nowMs: number,
  staleWarningMs: number,
  staleTimeoutMs: number
): number | null => {
  let nextCheckAtMs: number | null = null;

  for (const location of Object.values(locationsByEntityId)) {
    // 1) Stale styling boundary (ageMs >= staleWarningMs)
    if (staleWarningMs > 0) {
      const warnAtMs = location.receivedAt + staleWarningMs;
      if (warnAtMs <= nowMs) {
        // Already stale; nothing to schedule for warning.
      } else if (nextCheckAtMs === null || warnAtMs < nextCheckAtMs) {
        nextCheckAtMs = warnAtMs;
      }
    }

    // 2) Hide boundary (ageMs > staleTimeoutMs) => schedule for +1ms past.
    const hideAtMs = location.receivedAt + staleTimeoutMs + 1;
    if (hideAtMs <= nowMs) return 0;
    if (nextCheckAtMs === null || hideAtMs < nextCheckAtMs) {
      nextCheckAtMs = hideAtMs;
    }
  }

  if (nextCheckAtMs === null) return null;
  return Math.max(0, nextCheckAtMs - nowMs);
};

export function TrackedDeviceMarkersBridge() {
  const isOverlayVisible = useDashboardStore((s) => s.overlays.tracking);
  const locationsByEntityId = useDeviceLocationStore((s) => s.locationsByEntityId);
  const metadataByEntityId = useDeviceTrackerMetadataStore((s) => s.metadataByEntityId);
  const [staleTick, setStaleTick] = useState(0);

  const showDebugOverlay =
    import.meta.env.DEV &&
    (() => {
      try {
        return new URLSearchParams(window.location.search).has('debugOverlay');
      } catch {
        return false;
      }
    })();
  const debugMode = getTrackingDebugOverlayMode();
  const staleWarningMs = getTrackingStaleWarningMs();
  const staleTimeoutMs = getTrackingStaleTimeoutMs();

  useEffect(() => {
    const layer = getDevicesLayer();
    if (!layer) return;

    const nowMs = Date.now();

    if (!isOverlayVisible) {
      // Ensure we don't leave stale DOM behind when the overlay is disabled.
      syncMarkers(
        layer,
        false,
        {},
        metadataByEntityId,
        showDebugOverlay,
        debugMode,
        nowMs,
        staleWarningMs
      );
      return;
    }

    const filteredLocationsByEntityId = filterNonStaleLocations(
      locationsByEntityId,
      nowMs,
      staleTimeoutMs
    );

    // Initial sync
    syncMarkers(
      layer,
      true,
      filteredLocationsByEntityId,
      metadataByEntityId,
      showDebugOverlay,
      debugMode,
      nowMs,
      staleWarningMs
    );

    // The devices layer can be cleared/re-rendered by other code; re-apply markers.
    // Observe child list changes so our tracked markers are re-applied promptly.
    const observer = new MutationObserver(() => {
      syncMarkers(
        layer,
        true,
        filteredLocationsByEntityId,
        metadataByEntityId,
        showDebugOverlay,
        debugMode,
        nowMs,
        staleWarningMs
      );
    });

    observer.observe(layer, { childList: true });

    const nextDelayMs = getNextStaleCheckDelayMs(
      filteredLocationsByEntityId,
      nowMs,
      staleWarningMs,
      staleTimeoutMs
    );

    const timerId =
      nextDelayMs === null
        ? null
        : window.setTimeout(() => {
            setStaleTick((t) => t + 1);
          }, nextDelayMs);

    return () => {
      observer.disconnect();
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [
    isOverlayVisible,
    locationsByEntityId,
    metadataByEntityId,
    showDebugOverlay,
    debugMode,
    staleWarningMs,
    staleTimeoutMs,
    staleTick,
  ]);

  return null;
}
