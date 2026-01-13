import { useEffect, useMemo } from 'react';

import {
  DEFAULT_AREA_HUMIDITY_ENTITY_CANDIDATES,
  DEFAULT_AREA_TEMP_ENTITY_CANDIDATES,
  getAreaClimateEntityMappingFromEnv,
} from '../../features/climate/areaClimateEntityMapping';
import { useEntityStore } from '../../stores/useEntityStore';
import type { HaEntityId, HaEntityState } from '../../types/home-assistant';

type AreaClimateValue = {
  text: string;
};

type SensorKind = 'temperature' | 'humidity';

type HouseholdEntityIdLookup = Record<string, true>;

const hasHouseholdLabel = (entity: HaEntityState | undefined): boolean => {
  if (!entity) return false;

  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name : '';
  const name = typeof attrs?.name === 'string' ? attrs.name : '';

  const labelsUnknown = attrs?.labels;
  const labels: string[] = Array.isArray(labelsUnknown)
    ? labelsUnknown.filter((v): v is string => typeof v === 'string')
    : [];

  const parts = [entity.entity_id, friendlyName, name, ...labels]
    .map((v) => v.trim())
    .filter(Boolean);

  return parts.some((v) => v.toLowerCase().includes('household'));
};

const isHouseholdEntityId = (
  entityId: HaEntityId,
  entity: HaEntityState | undefined,
  householdEntityIds: HouseholdEntityIdLookup,
  allowAttributeFallback: boolean
): boolean => {
  if (householdEntityIds[entityId] === true) return true;
  if (!allowAttributeFallback) return false;
  return hasHouseholdLabel(entity);
};

const matchesSensorKind = (entity: HaEntityState | undefined, kind: SensorKind): boolean => {
  if (!entity) return false;

  const attrs = entity.attributes as Record<string, unknown> | undefined;
  const deviceClass = typeof attrs?.device_class === 'string' ? attrs.device_class : '';
  const unit = readUnit(entity);

  if (kind === 'humidity') {
    return deviceClass === 'humidity' || unit === '%';
  }

  // Temperature
  return deviceClass === 'temperature' || unit.includes('°');
};

const readNumber = (entity: HaEntityState | undefined): number | undefined => {
  if (!entity) return undefined;
  const value = Number.parseFloat(entity.state);
  return Number.isFinite(value) ? value : undefined;
};

const readUnit = (entity: HaEntityState | undefined): string => {
  const unit = (entity?.attributes as { unit_of_measurement?: unknown } | undefined)
    ?.unit_of_measurement;
  return typeof unit === 'string' && unit.trim() ? unit.trim() : '°F';
};

const normalizeRoomId = (roomId: string): string => {
  return roomId
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
  // Match whole token boundaries using underscores.
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|_)${escaped}(_|$)`);
  return re.test(value);
};

const keywordScore = (objectId: string, kind: SensorKind): number => {
  if (kind === 'humidity') {
    return objectId.includes('humidity') ? 30 : 0;
  }

  if (objectId.includes('temperature')) return 30;
  if (matchesToken(objectId, 'temp')) return 15;
  return 0;
};

const roomScore = (objectId: string, room: string): number => {
  if (!room) return 0;
  if (objectId === `${room}_temperature` || objectId === `${room}_humidity`) return 60;
  if (objectId.startsWith(`${room}_`)) return 40;
  if (objectId.endsWith(`_${room}`)) return 30;
  if (objectId.includes(`_${room}_`)) return 25;
  if (objectId.includes(room)) return 10;
  return 0;
};

const findBestMatchingSensorEntity = (
  roomId: string,
  entitiesById: Record<string, HaEntityState>,
  kind: SensorKind,
  requireHousehold: boolean,
  householdEntityIds: HouseholdEntityIdLookup,
  allowAttributeFallback: boolean
): HaEntityState | undefined => {
  const room = normalizeRoomId(roomId);

  let best: { score: number; entity: HaEntityState } | null = null;

  for (const [entityId, entity] of Object.entries(entitiesById)) {
    if (!entityId.startsWith('sensor.')) continue;

    if (
      requireHousehold &&
      !isHouseholdEntityId(entityId, entity, householdEntityIds, allowAttributeFallback)
    ) {
      continue;
    }
    if (!matchesSensorKind(entity, kind)) continue;

    const objectId = extractObjectId(entityId).toLowerCase();
    if (!objectId) continue;

    // Require room id to be present somewhere in the object_id.
    if (!objectId.includes(room)) continue;

    const kwScore = keywordScore(objectId, kind);
    if (kwScore <= 0) continue;

    const score = roomScore(objectId, room) + kwScore;
    if (score <= 0) continue;

    // Only accept sensors that have a numeric state.
    if (typeof readNumber(entity) !== 'number') continue;

    if (!best || score > best.score) {
      best = { score, entity };
    }
  }

  return best?.entity;
};

const findFirstMatchingHouseholdCandidate = (
  candidates: HaEntityId[],
  entitiesById: Record<string, HaEntityState>,
  householdEntityIds: HouseholdEntityIdLookup,
  allowAttributeFallback: boolean
): HaEntityState | undefined => {
  for (const id of candidates) {
    const entity = entitiesById[id];
    if (!entity) continue;
    if (!isHouseholdEntityId(id, entity, householdEntityIds, allowAttributeFallback)) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }
  return undefined;
};

const findFirstMatchingCandidate = (
  candidates: HaEntityId[],
  entitiesById: Record<string, HaEntityState>
): HaEntityState | undefined => {
  for (const id of candidates) {
    const entity = entitiesById[id];
    if (!entity) continue;
    if (typeof readNumber(entity) !== 'number') continue;
    return entity;
  }
  return undefined;
};

const getClimateOverlayVisibleNow = (): boolean => {
  const panel = document.getElementById('climate-panel');
  if (!panel) return false;
  return !panel.classList.contains('is-hidden');
};

const isSvgTextElement = (node: Element | null): node is SVGTextElement => {
  if (!node) return false;
  // JSDOM doesn't reliably expose SVGTextElement as a global constructor, so
  // avoid `instanceof SVGTextElement` checks.
  return (
    node.namespaceURI === 'http://www.w3.org/2000/svg' && node.tagName.toLowerCase() === 'text'
  );
};

const getLabelGroups = (): Array<{ roomId: string; group: SVGGElement; label: SVGTextElement }> => {
  const layer = document.getElementById('labels-layer');
  if (!(layer instanceof SVGGElement)) return [];

  const results: Array<{ roomId: string; group: SVGGElement; label: SVGTextElement }> = [];
  const groups = layer.querySelectorAll<SVGGElement>('.room-label-group[data-room-id]');
  for (const group of groups) {
    const roomId = group.getAttribute('data-room-id');
    if (!roomId) continue;

    const label = group.querySelector<SVGTextElement>('text.room-label');
    if (!isSvgTextElement(label)) continue;

    results.push({ roomId, group, label });
  }

  return results;
};

const findOrCreateClimateTextEl = (
  group: SVGGElement,
  roomId: string,
  label: SVGTextElement
): SVGTextElement => {
  const existing = group.querySelector<SVGTextElement>(
    `text.room-climate[data-room-id="${roomId}"]`
  );
  if (isSvgTextElement(existing)) return existing;

  const svg = group.ownerSVGElement;
  const climateEl = group.ownerDocument.createElementNS(
    svg?.namespaceURI ?? 'http://www.w3.org/2000/svg',
    'text'
  ) as unknown as SVGTextElement;

  const x = label.getAttribute('x') ?? '0';
  const y = label.getAttribute('y') ?? '0';

  climateEl.setAttribute('x', x);
  climateEl.setAttribute('y', y);
  climateEl.setAttribute('text-anchor', 'middle');
  climateEl.setAttribute('dominant-baseline', 'middle');
  climateEl.setAttribute('dy', '1.45em');
  climateEl.setAttribute('class', 'room-climate');
  climateEl.setAttribute('data-room-id', roomId);

  // Match prototype behavior: elements are hidden by default and shown when the climate overlay is active.
  if (!getClimateOverlayVisibleNow()) {
    climateEl.classList.add('is-hidden');
  }

  group.appendChild(climateEl);
  return climateEl;
};

const computeAreaClimateText = (
  roomId: string,
  entitiesById: Record<string, HaEntityState>,
  mapping: ReturnType<typeof getAreaClimateEntityMappingFromEnv>,
  householdEntityIds: HouseholdEntityIdLookup,
  allowAttributeFallback: boolean
): AreaClimateValue | null => {
  const configured = mapping[roomId];

  const configuredTempEntity = configured?.temperature
    ? entitiesById[configured.temperature]
    : undefined;
  const configuredHumidityEntity = configured?.humidity
    ? entitiesById[configured.humidity]
    : undefined;

  const tempCandidates: HaEntityId[] = configured?.temperature
    ? [configured.temperature]
    : DEFAULT_AREA_TEMP_ENTITY_CANDIDATES(roomId);

  const humidityCandidates: HaEntityId[] = configured?.humidity
    ? [configured.humidity]
    : DEFAULT_AREA_HUMIDITY_ENTITY_CANDIDATES(roomId);

  // Explicit mapping should win even if the entity registry labels aren't present
  // in `state_changed` payloads.
  const tempEntityFromMapping =
    typeof readNumber(configuredTempEntity) === 'number' ? configuredTempEntity : undefined;
  const humidityEntityFromMapping =
    typeof readNumber(configuredHumidityEntity) === 'number' ? configuredHumidityEntity : undefined;

  // Prefer household-labeled sensors when any exist for the room, but don't
  // require them when HA state payloads don't carry labels.
  const tempHouseholdCandidate = findFirstMatchingHouseholdCandidate(
    tempCandidates,
    entitiesById,
    householdEntityIds,
    allowAttributeFallback
  );
  const tempHouseholdHeuristic = findBestMatchingSensorEntity(
    roomId,
    entitiesById,
    'temperature',
    true,
    householdEntityIds,
    allowAttributeFallback
  );
  const tempUnlabeledCandidate = findFirstMatchingCandidate(tempCandidates, entitiesById);
  const tempUnlabeledHeuristic = findBestMatchingSensorEntity(
    roomId,
    entitiesById,
    'temperature',
    false,
    householdEntityIds,
    allowAttributeFallback
  );

  const humidityHouseholdCandidate = findFirstMatchingHouseholdCandidate(
    humidityCandidates,
    entitiesById,
    householdEntityIds,
    allowAttributeFallback
  );
  const humidityHouseholdHeuristic = findBestMatchingSensorEntity(
    roomId,
    entitiesById,
    'humidity',
    true,
    householdEntityIds,
    allowAttributeFallback
  );
  const humidityUnlabeledCandidate = findFirstMatchingCandidate(humidityCandidates, entitiesById);
  const humidityUnlabeledHeuristic = findBestMatchingSensorEntity(
    roomId,
    entitiesById,
    'humidity',
    false,
    householdEntityIds,
    allowAttributeFallback
  );

  const tempEntity =
    tempEntityFromMapping ??
    tempHouseholdCandidate ??
    tempHouseholdHeuristic ??
    tempUnlabeledCandidate ??
    tempUnlabeledHeuristic;

  const humidityEntity =
    humidityEntityFromMapping ??
    humidityHouseholdCandidate ??
    humidityHouseholdHeuristic ??
    humidityUnlabeledCandidate ??
    humidityUnlabeledHeuristic;

  const temp = readNumber(tempEntity);
  const humidity = readNumber(humidityEntity);

  const parts: string[] = [];
  if (typeof temp === 'number') {
    const unit = readUnit(tempEntity);
    parts.push(`${Math.round(temp)}${unit}`);
  }
  if (typeof humidity === 'number') {
    parts.push(`${Math.round(humidity)}%`);
  }

  const text = parts.join(' • ');
  return text ? { text } : null;
};

export function HaAreaClimateOverlayBridge() {
  const entitiesById = useEntityStore((s) => s.entitiesById);
  const householdEntityIds = useEntityStore((s) => s.householdEntityIds);

  const allowAttributeFallback = useMemo(
    () => Object.keys(householdEntityIds).length === 0,
    [householdEntityIds]
  );

  const mapping = useMemo(() => getAreaClimateEntityMappingFromEnv(), []);

  useEffect(() => {
    const apply = () => {
      const isOverlayVisible = getClimateOverlayVisibleNow();
      const groups = getLabelGroups();
      for (const { roomId, group, label } of groups) {
        const value = computeAreaClimateText(
          roomId,
          entitiesById,
          mapping,
          householdEntityIds,
          allowAttributeFallback
        );

        const existing = group.querySelector<SVGTextElement>(
          `text.room-climate[data-room-id="${roomId}"]`
        );

        if (!value) {
          if (isSvgTextElement(existing)) {
            existing.remove();
          }
          continue;
        }

        const el = findOrCreateClimateTextEl(group, roomId, label);
        el.classList.toggle('is-hidden', !isOverlayVisible);
        if (el.textContent !== value.text) {
          el.textContent = value.text;
        }
      }
    };

    apply();

    const layer = document.getElementById('labels-layer');
    if (!(layer instanceof SVGGElement)) return;

    const observer = new MutationObserver(() => {
      apply();
    });

    observer.observe(layer, { subtree: true, childList: true });

    return () => {
      observer.disconnect();
    };
  }, [allowAttributeFallback, entitiesById, householdEntityIds, mapping]);

  return null;
}
