import { useEffect, useMemo, useRef } from 'react';

import { TYPES } from '../../../core/types';
import type { FloorplanModel } from '../../../features/model/floorplan';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { useService } from '../../../hooks/useService';
import type { IHomeAssistantClient } from '../../../interfaces/IHomeAssistantClient';
import { useDashboardStore } from '../../../stores/useDashboardStore';
import { useEntityStore } from '../../../stores/useEntityStore';
import type { HaEntityId, HaEntityState } from '../../../types/home-assistant';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('hass-dash');

type RoomInfo = {
  id: string;
  name: string;
  cx: number;
  cy: number;
};

type RoomLightGroup = {
  room: RoomInfo;
  entityIds: HaEntityId[];
  anyOn: boolean;
};

type RoomLabelAnchor = {
  cx: number;
  cy: number;
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

const resizeLightToggles = (svg: SVGSVGElement): void => {
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return;

  const vb = readViewBoxRaw(svg.getAttribute('viewBox'));
  if (!vb?.w) return;

  const unitsPerPx = vb.w / rect.width;

  const lightToggles = svg.querySelectorAll('.light-toggle');
  for (const g of lightToggles) {
    if (!(g instanceof SVGGElement)) continue;

    const cx = Number(g.getAttribute('data-cx'));
    const cy = Number(g.getAttribute('data-cy'));
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

    const bgW = 34 * unitsPerPx;
    const bgH = 26 * unitsPerPx;
    const bgR = 10 * unitsPerPx;
    const iconSize = 18 * unitsPerPx;
    const yOffset = 28 * unitsPerPx;

    g.setAttribute('transform', `translate(${cx} ${cy + yOffset})`);

    const bg = g.querySelector('.light-toggle-bg');
    if (bg instanceof SVGRectElement) {
      bg.setAttribute('width', String(bgW));
      bg.setAttribute('height', String(bgH));
      bg.setAttribute('x', String(-bgW / 2));
      bg.setAttribute('y', String(-bgH / 2));
      bg.setAttribute('rx', String(bgR));
      bg.setAttribute('ry', String(bgR));
    }

    const icon = g.querySelector('.light-toggle-icon');
    if (icon instanceof SVGUseElement) {
      icon.setAttribute('width', String(iconSize));
      icon.setAttribute('height', String(iconSize));
      icon.setAttribute('x', String(-iconSize / 2));
      icon.setAttribute('y', String(-iconSize / 2));
    }
  }
};

const normalizeToken = (value: string): string => {
  return value
    .trim()
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

const extractObjectId = (entityId: string): string => {
  const parts = entityId.split('.');
  return parts.length === 2 ? (parts[1] ?? '') : '';
};

const matchesToken = (value: string, token: string): boolean => {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|_)${escaped}(_|$)`);
  return re.test(value);
};

const isHouseholdEntityId = (
  entityId: string,
  householdEntityIds: Record<string, true>
): boolean => {
  const keys = Object.keys(householdEntityIds);
  if (keys.length === 0) return true;
  return householdEntityIds[entityId] === true;
};

const computeCentroid = (points: Array<[number, number]>): { cx: number; cy: number } => {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return {
    cx: sx / points.length,
    cy: sy / points.length,
  };
};

const buildRoomIndex = (model: FloorplanModel | null): Map<string, RoomInfo> => {
  const map = new Map<string, RoomInfo>();
  if (!model) return map;

  for (const floor of model.floors) {
    for (const room of floor.rooms) {
      const { cx, cy } = computeCentroid(room.points);
      map.set(room.id, { id: room.id, name: room.name, cx, cy });
    }
  }

  return map;
};

const findRoomsInDom = (doc: Document): string[] => {
  const labelsLayer = doc.getElementById('labels-layer');
  if (!(labelsLayer instanceof SVGGElement)) return [];

  const groups = labelsLayer.querySelectorAll<SVGGElement>('.room-label-group[data-room-id]');
  return Array.from(groups)
    .map((g) => g.getAttribute('data-room-id') ?? '')
    .map((v) => v.trim())
    .filter(Boolean);
};

const readRoomLabelAnchors = (doc: Document): Map<string, RoomLabelAnchor> => {
  const labelsLayer = doc.getElementById('labels-layer');
  if (!(labelsLayer instanceof SVGGElement)) return new Map();

  const anchors = new Map<string, RoomLabelAnchor>();
  const groups = labelsLayer.querySelectorAll<SVGGElement>('.room-label-group[data-room-id]');

  for (const group of groups) {
    const roomId = (group.getAttribute('data-room-id') ?? '').trim();
    if (!roomId) continue;

    // Prefer the actual room label text if present.
    const text = group.querySelector<SVGTextElement>('text.room-label, text');
    const candidate = (text ?? group) as unknown as SVGGraphicsElement;

    // Primary: use getBBox() when available (real browser runtime).
    try {
      if (candidate && typeof candidate.getBBox === 'function') {
        const bbox = candidate.getBBox();
        if (
          Number.isFinite(bbox.x) &&
          Number.isFinite(bbox.y) &&
          bbox.width > 0 &&
          bbox.height > 0
        ) {
          anchors.set(roomId, { cx: bbox.x + bbox.width / 2, cy: bbox.y + bbox.height });
          continue;
        }
      }
    } catch {
      // Ignore and fall back to attribute parsing.
    }

    // Fallback: parse x/y attributes for environments without getBBox (e.g., JSDOM tests)
    // or for labels that are positioned explicitly via attributes.
    if (text) {
      const xAttr = text.getAttribute('x');
      const yAttr = text.getAttribute('y');
      const x = xAttr ? Number(xAttr) : NaN;
      const y = yAttr ? Number(yAttr) : NaN;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        anchors.set(roomId, { cx: x, cy: y });
      }
    }
  }

  return anchors;
};

const computeRoomLightGroups = (
  roomIds: string[],
  roomIndex: Map<string, RoomInfo>,
  labelAnchors: Map<string, RoomLabelAnchor>,
  entitiesById: Record<string, HaEntityState>,
  householdEntityIds: Record<string, true>
): RoomLightGroup[] => {
  const allLights = Object.entries(entitiesById)
    .filter(([id]) => id.startsWith('light.'))
    .map(([, entity]) => entity)
    .filter((entity) => isHouseholdEntityId(entity.entity_id, householdEntityIds));

  const groups: RoomLightGroup[] = [];

  for (const roomId of roomIds) {
    const modelRoom = roomIndex.get(roomId);
    const anchor = labelAnchors.get(roomId);
    const room: RoomInfo | null = (() => {
      if (anchor) {
        return {
          id: roomId,
          name: modelRoom?.name ?? roomId,
          cx: anchor.cx,
          cy: anchor.cy,
        };
      }

      if (modelRoom) return modelRoom;
      return null;
    })();

    if (!room) continue;

    const token = normalizeToken(roomId);

    const matching = allLights.filter((entity) => {
      const objectId = normalizeToken(extractObjectId(entity.entity_id));
      if (!objectId) return false;
      return objectId.includes(token) || matchesToken(objectId, token);
    });

    const entityIds = matching.map((e) => e.entity_id);
    if (entityIds.length === 0) continue;

    const anyOn = matching.some((e) => String(e.state).toLowerCase() === 'on');

    groups.push({ room, entityIds, anyOn });
  }

  return groups;
};

const isLightingOverlayVisible = (activePanel: string | null): boolean => {
  // light toggles only show when lighting panel is active.
  return activePanel === 'lighting';
};

export function HaRoomLightingOverlayBridge() {
  const haClient = useService<IHomeAssistantClient>(TYPES.IHomeAssistantClient);
  const { isEnabled: haEnabled } = useFeatureFlag('HA_CONNECTION');

  const hasLoggedMountRef = useRef(false);
  const hasLoggedDebugListenersRef = useRef(false);
  const lastToggleCountRef = useRef<number | null>(null);

  const delegatedRef = useRef<{
    enabled: boolean;
    invoke: (toggle: SVGGElement) => void;
    downByPointerId: Map<number, { x: number; y: number; t: number; toggle: SVGGElement }>;
  }>({
    enabled: false,
    // Will be replaced on first effect run.
    invoke: () => {
      return;
    },
    downByPointerId: new Map(),
  });

  const hasInstalledDelegatedListenersRef = useRef(false);

  const floorplanModel = useDashboardStore((s) => s.floorplan?.model ?? null);
  const activePanel = useDashboardStore((s) => s.activePanel);

  const entitiesById = useEntityStore((s) => s.entitiesById);
  const householdEntityIds = useEntityStore((s) => s.householdEntityIds);
  const optimisticSetState = useEntityStore((s) => s.optimisticSetState);

  const roomIndex = useMemo(() => buildRoomIndex(floorplanModel), [floorplanModel]);

  const shouldInvokeToggle = (toggle: SVGGElement): boolean => {
    const lastRaw = toggle.getAttribute('data-hassdash-last-invoke') ?? '';
    const last = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(last) && Date.now() - last < 350) return false;
    toggle.setAttribute('data-hassdash-last-invoke', String(Date.now()));
    return true;
  };

  useEffect(() => {
    if (hasInstalledDelegatedListenersRef.current) return;
    hasInstalledDelegatedListenersRef.current = true;

    const ACTIVATION_MAX_MOVE_PX = 6;
    const ACTIVATION_MAX_MS = 800;

    const debugDelegated = (() => {
      try {
        return new URLSearchParams(window.location.search).has('debugLights');
      } catch {
        return false;
      }
    })();

    const onDelegatedPointerDown = (e: PointerEvent) => {
      const state = delegatedRef.current;
      if (!state.enabled) return;
      const target = e.target instanceof Element ? e.target : null;
      const toggle = target?.closest?.('g.light-toggle') as SVGGElement | null;
      if (!toggle) return;

      if (debugDelegated) {
        console.debug('[lights] delegated pointerdown matched toggle', {
          roomId: toggle.getAttribute('data-room-id') ?? '',
        });
      }

      state.downByPointerId.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now(), toggle });
    };

    const onDelegatedPointerUp = (e: PointerEvent) => {
      const state = delegatedRef.current;
      if (!state.enabled) return;

      const record = state.downByPointerId.get(e.pointerId);
      state.downByPointerId.delete(e.pointerId);

      const targetEl = e.target instanceof Element ? e.target : null;
      const pointEl = document.elementFromPoint(e.clientX, e.clientY);
      const toggleFromTarget = targetEl?.closest?.('g.light-toggle') as SVGGElement | null;
      const toggleFromPoint = pointEl?.closest?.('g.light-toggle') as SVGGElement | null;
      const fallbackToggle = toggleFromTarget ?? toggleFromPoint;

      if (!record) {
        if (!fallbackToggle || !fallbackToggle.isConnected) return;

        const roomId = fallbackToggle.getAttribute('data-room-id') ?? '';
        const roomIdEscaped = roomId.replaceAll('"', '\\"');
        const hassdashToggle = document.querySelector(
          `g.light-toggle[data-hassdash][data-room-id="${roomIdEscaped}"]`
        ) as SVGGElement | null;
        const resolved = hassdashToggle ?? fallbackToggle;

        if (debugDelegated) {
          console.debug('[lights] delegated pointerup fallback invoke', {
            roomId: resolved.getAttribute('data-room-id') ?? '',
            isHassdash: resolved.hasAttribute('data-hassdash'),
          });
        }

        if (!shouldInvokeToggle(resolved)) return;
        e.preventDefault();
        e.stopPropagation();
        state.invoke(resolved);
        resolved.focus({ preventScroll: true });
        return;
      }

      const dx = e.clientX - record.x;
      const dy = e.clientY - record.y;
      const dist = Math.hypot(dx, dy);
      const age = Date.now() - record.t;
      if (dist > ACTIVATION_MAX_MOVE_PX) return;
      if (age > ACTIVATION_MAX_MS) return;

      const resolvedToggle = record.toggle.isConnected ? record.toggle : fallbackToggle;

      if (!resolvedToggle || !resolvedToggle.isConnected) {
        if (debugDelegated) {
          console.warn('[lights] delegated pointerup: no connected toggle', {
            recordConnected: record.toggle.isConnected,
            hasTargetToggle: Boolean(toggleFromTarget),
            hasPointToggle: Boolean(toggleFromPoint),
          });
        }
        return;
      }

      const roomId = resolvedToggle.getAttribute('data-room-id') ?? '';
      const roomIdEscaped = roomId.replaceAll('"', '\\"');
      const hassdashToggle = document.querySelector(
        `g.light-toggle[data-hassdash][data-room-id="${roomIdEscaped}"]`
      ) as SVGGElement | null;
      const resolved = hassdashToggle ?? resolvedToggle;

      if (debugDelegated) {
        console.debug('[lights] delegated pointerup invoke', {
          roomId: resolved.getAttribute('data-room-id') ?? '',
          isHassdash: resolved.hasAttribute('data-hassdash'),
        });
      }

      if (!shouldInvokeToggle(resolved)) return;
      e.preventDefault();
      e.stopPropagation();
      state.invoke(resolved);
      resolved.focus({ preventScroll: true });
    };

    const onDelegatedClick = (e: MouseEvent) => {
      const state = delegatedRef.current;
      if (!state.enabled) return;
      const target = e.target instanceof Element ? e.target : null;
      const toggle = target?.closest?.('g.light-toggle') as SVGGElement | null;
      if (!toggle) return;
      if (!toggle.isConnected) return;
      if (toggle.classList.contains('is-hidden')) return;

      if (debugDelegated) {
        console.debug('[lights] delegated click matched toggle', {
          roomId: toggle.getAttribute('data-room-id') ?? '',
        });
      }

      const roomId = toggle.getAttribute('data-room-id') ?? '';
      const roomIdEscaped = roomId.replaceAll('"', '\\"');
      const hassdashToggle = document.querySelector(
        `g.light-toggle[data-hassdash][data-room-id="${roomIdEscaped}"]`
      ) as SVGGElement | null;
      const resolved = hassdashToggle ?? toggle;

      if (!shouldInvokeToggle(resolved)) return;
      e.preventDefault();
      e.stopPropagation();
      state.invoke(resolved);
      resolved.focus({ preventScroll: true });
    };

    document.addEventListener('pointerdown', onDelegatedPointerDown, { capture: true });
    document.addEventListener('pointerup', onDelegatedPointerUp, { capture: true });
    document.addEventListener('click', onDelegatedClick, { capture: true });

    const delegatedStateForCleanup = delegatedRef.current;

    return () => {
      document.removeEventListener('pointerdown', onDelegatedPointerDown, { capture: true });
      document.removeEventListener('pointerup', onDelegatedPointerUp, { capture: true });
      document.removeEventListener('click', onDelegatedClick, { capture: true });
      delegatedStateForCleanup.downByPointerId.clear();

      // Important for React StrictMode in dev: effects run setup → cleanup → setup.
      // If we keep the guard set to true, the second setup will bail out and
      // we'll end up with no delegated listeners installed.
      hasInstalledDelegatedListenersRef.current = false;
    };
  }, []);

  useEffect(() => {
    const svg = document.getElementById('floorplan-svg');
    const lightsLayer = document.getElementById('lights-layer');

    if (!(svg instanceof SVGSVGElement)) return;
    if (!(lightsLayer instanceof SVGGElement)) return;

    const logLevelRaw = import.meta.env.VITE_LOG_LEVEL;
    const logLevel = typeof logLevelRaw === 'string' ? logLevelRaw.trim().toLowerCase() : '';

    const debugViaQuery = (() => {
      try {
        return new URLSearchParams(window.location.search).has('debugLights');
      } catch {
        return false;
      }
    })();

    const debugEvents = import.meta.env.DEV && (logLevel === 'debug' || debugViaQuery);
    const debugReason = debugViaQuery ? 'query' : logLevel === 'debug' ? 'env' : 'off';

    delegatedRef.current.enabled = haEnabled;

    // Log mount once to avoid spamming when this effect re-runs frequently.
    if (!hasLoggedMountRef.current) {
      hasLoggedMountRef.current = true;
      logger.info('[lights] bridge mounted', {
        dev: Boolean(import.meta.env.DEV),
        logLevel: logLevel || '(default)',
        debugEvents,
        debugReason,
        managedBy: lightsLayer.getAttribute('data-managed-by') ?? '',
      });
    }

    const describeEl = (el: Element | null): string => {
      if (!el) return '(null)';
      const id = el.getAttribute('id');
      const cls = el.getAttribute('class');
      return `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''}`;
    };

    let debugEventLogCount = 0;
    const DEBUG_EVENT_LOG_LIMIT = 40;

    const logEvent = (label: string, e: Event): void => {
      if (!debugEvents) return;

      // Avoid flooding the console: cap logs per mount.
      if (debugEventLogCount >= DEBUG_EVENT_LOG_LIMIT) return;
      debugEventLogCount += 1;

      const target = e.target instanceof Element ? e.target : null;
      const current = e.currentTarget instanceof Element ? e.currentTarget : null;
      const targetToggle = target?.closest?.('g.light-toggle') ?? null;

      const me = e as MouseEvent;
      const hasPoint = Number.isFinite(me.clientX) && Number.isFinite(me.clientY);
      const atPoint = hasPoint ? document.elementFromPoint(me.clientX, me.clientY) : null;
      const pointToggle = atPoint?.closest?.('g.light-toggle') ?? null;

      // Prefer logging everything in debug mode so we can see what is actually
      // receiving events even when a toggle click does nothing.

      const pe = e as PointerEvent;
      const row = {
        type: e.type,
        eventPhase: e.eventPhase,
        defaultPrevented: (e as { defaultPrevented?: boolean }).defaultPrevented ?? false,
        target: describeEl(target),
        currentTarget: describeEl(current),
        elementFromPoint: describeEl(atPoint),
        targetToggle: describeEl(targetToggle),
        pointToggle: describeEl(pointToggle),
        roomId:
          targetToggle?.getAttribute('data-room-id') ??
          pointToggle?.getAttribute('data-room-id') ??
          '',
        pointerType: typeof pe.pointerType === 'string' ? pe.pointerType : '',
        button: Number.isFinite(pe.button) ? pe.button : undefined,
        buttons: Number.isFinite(pe.buttons) ? pe.buttons : undefined,
        isPrimary: typeof pe.isPrimary === 'boolean' ? pe.isPrimary : undefined,
        clientX: hasPoint ? me.clientX : undefined,
        clientY: hasPoint ? me.clientY : undefined,
      };

      // IMPORTANT: When debug is enabled via query param, bypass the app logger
      // (which may be filtered to info) and write directly to the console.
      if (debugViaQuery) {
        console.groupCollapsed(label);
        console.table(row);
        console.groupEnd();
        return;
      }

      logger.debugGroupCollapsed(label);
      logger.debugTable(row);
      logger.debugGroupEnd();
    };

    // Capture-phase listeners help detect if clicks are being suppressed upstream.
    // These are only active when VITE_LOG_LEVEL=debug (or ?debugLights=1) in dev.
    const onSvgPointerDown = (e: Event) => logEvent('[lights] svg capture pointerdown', e);
    const onSvgPointerUp = (e: Event) => logEvent('[lights] svg capture pointerup', e);
    const onSvgClick = (e: Event) => logEvent('[lights] svg capture click', e);

    const onDocPointerDown = (e: Event) => logEvent('[lights] document capture pointerdown', e);
    const onDocPointerUp = (e: Event) => logEvent('[lights] document capture pointerup', e);
    const onDocClick = (e: Event) => logEvent('[lights] document capture click', e);

    let debugCaptureAttached = false;
    const detachDebugCapture = () => {
      if (!debugCaptureAttached) return;
      debugCaptureAttached = false;

      svg.removeEventListener('pointerdown', onSvgPointerDown, { capture: true });
      svg.removeEventListener('pointerup', onSvgPointerUp, { capture: true });
      svg.removeEventListener('click', onSvgClick, { capture: true });

      document.removeEventListener('pointerdown', onDocPointerDown, { capture: true });
      document.removeEventListener('pointerup', onDocPointerUp, { capture: true });
      document.removeEventListener('click', onDocClick, { capture: true });
    };

    if (debugEvents) {
      svg.addEventListener('pointerdown', onSvgPointerDown, { capture: true });
      svg.addEventListener('pointerup', onSvgPointerUp, { capture: true });
      svg.addEventListener('click', onSvgClick, { capture: true });

      document.addEventListener('pointerdown', onDocPointerDown, { capture: true });
      document.addEventListener('pointerup', onDocPointerUp, { capture: true });
      document.addEventListener('click', onDocClick, { capture: true });

      debugCaptureAttached = true;

      if (!hasLoggedDebugListenersRef.current) {
        hasLoggedDebugListenersRef.current = true;
        logger.info('[lights] debug capture listeners installed', {
          debugReason,
        });
      }
    }

    const readEntityIdsFromToggle = (toggle: SVGGElement): HaEntityId[] => {
      const raw = toggle.getAttribute('data-entity-ids') ?? '';
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean) as HaEntityId[];
    };

    const invokeToggle = async (toggle: SVGGElement): Promise<void> => {
      const roomId = toggle.getAttribute('data-room-id') ?? '';
      if (toggle.classList.contains('is-hidden')) return;

      const entityIds = readEntityIdsFromToggle(toggle);
      if (entityIds.length === 0) {
        if (debugViaQuery) {
          console.info('[lights] invoke skipped (no entity ids)', roomId);
        }
        return;
      }

      const wasOn = toggle.classList.contains('is-on');
      const service = wasOn ? 'turn_off' : 'turn_on';
      const nextIsOn = service === 'turn_on';
      const nextState = nextIsOn ? 'on' : 'off';

      // Optimistically update the UI immediately.
      // Home Assistant call_service results can lag even when the device reacts instantly.
      // HA's own UI behaves optimistically; we mirror that here and reconcile via
      // state_changed updates (or rollback on error).
      const previousStatesByEntityId = new Map<HaEntityId, string | undefined>();
      for (const entityId of entityIds) {
        previousStatesByEntityId.set(entityId, entitiesById[entityId]?.state);
        optimisticSetState(entityId, nextState);
      }

      toggle.classList.toggle('is-on', nextIsOn);
      toggle.setAttribute('data-optimistic-until', String(Date.now() + 1500));

      if (debugViaQuery) {
        console.info('[lights] invoke', roomId, service, entityIds);
      } else if (debugEvents) {
        logger.debug('[lights] invoke', roomId, service, entityIds);
      }

      try {
        await haClient.connect();
        await haClient.callService({
          domain: 'light',
          service,
          service_data: {
            entity_id: entityIds,
          },
          target: {
            entity_id: entityIds,
          },
        });
      } catch (error: unknown) {
        // Rollback the optimistic UI/store update.
        toggle.classList.toggle('is-on', wasOn);
        toggle.removeAttribute('data-optimistic-until');

        for (const entityId of entityIds) {
          const prev = previousStatesByEntityId.get(entityId);
          if (typeof prev === 'string') {
            optimisticSetState(entityId, prev);
          }
        }
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Failed to call Home Assistant light.${service} for ${entityIds.join(', ')}: ${message}`
        );
      }
    };

    delegatedRef.current.invoke = (toggle: SVGGElement) => {
      void invokeToggle(toggle);
    };

    if (!haEnabled) {
      lightsLayer.removeAttribute('data-managed-by');

      // Remove only the HA-driven toggles that we created.
      const existing = lightsLayer.querySelectorAll<SVGGElement>('g.light-toggle[data-hassdash]');
      for (const el of existing) {
        el.remove();
      }

      if (debugEvents) {
        logger.debug('[lights] HA disabled; removed hassdash toggles:', existing.length);
      }

      detachDebugCapture();
      return;
    }

    lightsLayer.setAttribute('data-managed-by', 'react');

    // Ensure the lights layer is painted above other layers so it can receive clicks.
    // In SVG, the last child wins (top-most paint order).
    const parent = lightsLayer.parentElement;
    if (parent) parent.appendChild(lightsLayer);

    // Ensure the clickable toggle is always the HA-backed one by removing any
    // non-managed/stale toggles that might still be around.
    const nonManagedToggles = lightsLayer.querySelectorAll<SVGGElement>(
      'g.light-toggle:not([data-hassdash])'
    );
    for (const el of nonManagedToggles) {
      el.remove();
    }

    if (debugEvents && nonManagedToggles.length) {
      logger.debug('[lights] removed non-managed toggles:', nonManagedToggles.length);
    }

    const roomIds = findRoomsInDom(document);
    const labelAnchors = readRoomLabelAnchors(document);
    const groups = computeRoomLightGroups(
      roomIds,
      roomIndex,
      labelAnchors,
      entitiesById,
      householdEntityIds
    );
    const visible = isLightingOverlayVisible(activePanel);

    if (debugEvents) {
      logger.debug(
        '[lights] roomIds:',
        roomIds.length,
        'groups:',
        groups.length,
        'visible:',
        visible
      );
    }

    const desiredByRoomId = new Map<string, RoomLightGroup>();
    for (const group of groups) {
      desiredByRoomId.set(group.room.id, group);
    }

    const existingToggles = lightsLayer.querySelectorAll<SVGGElement>(
      'g.light-toggle[data-hassdash][data-room-id]'
    );
    const existingByRoomId = new Map<string, SVGGElement>();
    for (const el of existingToggles) {
      const roomId = (el.getAttribute('data-room-id') ?? '').trim();
      if (!roomId) continue;
      existingByRoomId.set(roomId, el);
    }

    // Remove any stale HA toggles.
    for (const [roomId, el] of existingByRoomId.entries()) {
      if (!desiredByRoomId.has(roomId)) {
        el.remove();
        existingByRoomId.delete(roomId);
      }
    }

    // Create/update desired toggles without replacing DOM nodes (prevents losing
    // pointer state between pointerdown and click).
    for (const group of groups) {
      const existing = existingByRoomId.get(group.room.id);
      const toggle =
        existing ?? (document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement);

      if (!existing) {
        toggle.setAttribute('class', 'light-toggle');
        toggle.setAttribute('data-hassdash', '1');
        toggle.setAttribute('data-room-id', group.room.id);
        toggle.setAttribute('tabindex', '0');
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-label', `Toggle lights: ${group.room.name}`);
        toggle.style.cursor = 'pointer';
        toggle.style.pointerEvents = 'all';

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
        bg.setAttribute('class', 'light-toggle-bg');
        bg.style.pointerEvents = 'all';
        toggle.appendChild(bg);

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'use') as SVGUseElement;
        icon.setAttribute('class', 'light-toggle-icon');
        icon.setAttribute('href', '#lightBulb');
        icon.setAttribute('xlink:href', '#lightBulb');
        icon.style.pointerEvents = 'all';
        toggle.appendChild(icon);
      }

      // Defensive: ensure child elements can receive pointer events even if CSS
      // elsewhere disables them.
      const bgExisting = toggle.querySelector('.light-toggle-bg');
      if (bgExisting instanceof Element && bgExisting.tagName.toLowerCase() === 'rect') {
        (bgExisting as SVGElement).style.pointerEvents = 'all';
      }
      const iconExisting = toggle.querySelector('.light-toggle-icon');
      if (iconExisting instanceof Element && iconExisting.tagName.toLowerCase() === 'use') {
        (iconExisting as SVGElement).style.pointerEvents = 'all';
      }

      // Always update position and state.
      toggle.setAttribute('data-cx', String(group.room.cx));
      toggle.setAttribute('data-cy', String(group.room.cy));
      toggle.setAttribute('data-entity-ids', group.entityIds.join(','));

      // If we recently applied an optimistic toggle, avoid immediately overwriting
      // it during frequent effect re-runs.
      const optimisticUntilRaw = toggle.getAttribute('data-optimistic-until');
      const optimisticUntil = optimisticUntilRaw ? Number(optimisticUntilRaw) : 0;
      if (!(Number.isFinite(optimisticUntil) && optimisticUntil > Date.now())) {
        toggle.classList.toggle('is-on', group.anyOn);
        toggle.removeAttribute('data-optimistic-until');
      }
      toggle.classList.toggle('is-hidden', !visible);

      // Bind listeners exactly once.
      if (!toggle.hasAttribute('data-hassdash-bound')) {
        toggle.setAttribute('data-hassdash-bound', '1');
        // Keyboard activation remains per-toggle for accessibility.
        toggle.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();

            if (!shouldInvokeToggle(toggle)) return;
            delegatedRef.current.invoke(toggle);
          }
        });
      }

      if (!existing) {
        lightsLayer.appendChild(toggle);
      }
    }

    // Avoid spamming: log only when the count changes.
    if (lastToggleCountRef.current !== groups.length) {
      lastToggleCountRef.current = groups.length;
      logger.info('[lights] created light toggles', {
        count: groups.length,
        visible,
      });
    }

    resizeLightToggles(svg);

    let rafId: number | null = null;
    const scheduleResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        resizeLightToggles(svg);
      });
    };

    const mutationObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'viewBox') {
          scheduleResize();
          return;
        }
      }
    });
    mutationObserver.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleResize();
          })
        : null;
    resizeObserver?.observe(svg);

    window.addEventListener('resize', scheduleResize);

    return () => {
      detachDebugCapture();
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [
    haEnabled,
    haClient,
    roomIndex,
    entitiesById,
    householdEntityIds,
    activePanel,
    optimisticSetState,
  ]);

  return null;
}
