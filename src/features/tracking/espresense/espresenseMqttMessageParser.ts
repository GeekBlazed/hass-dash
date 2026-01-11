const ESPRESENSE_DEVICES_TOPIC_PREFIX = 'espresense/devices/';

type HaMqttEventData = {
  topic?: unknown;
  payload?: unknown;
};

type EspresenseDevicePayload = {
  id?: unknown;
  name?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const normalizeDeviceIdToEntityId = (deviceId: string): string => {
  // ESPresense ids contain ':' (e.g. phone:jeremy). HA entity ids use '_' (device_tracker.phone_jeremy).
  return `device_tracker.${deviceId.replaceAll(':', '_')}`;
};

const parseDeviceIdFromTopic = (topic: string): string | undefined => {
  if (!topic.startsWith(ESPRESENSE_DEVICES_TOPIC_PREFIX)) return undefined;
  const rest = topic.slice(ESPRESENSE_DEVICES_TOPIC_PREFIX.length);
  const [deviceId] = rest.split('/', 1);
  return deviceId || undefined;
};

const tryParsePayloadJson = (payload: unknown): EspresenseDevicePayload | null => {
  if (isRecord(payload)) return payload as EspresenseDevicePayload;

  const raw = asString(payload);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    return parsed as EspresenseDevicePayload;
  } catch {
    return null;
  }
};

/**
 * Best-effort extraction of ESPresense device labels from Home Assistant mqtt events.
 *
 * Expected topic pattern:
 * - espresense/devices/<deviceId>/<nodeId>
 *
 * Expected payload:
 * - JSON with at least { id: "phone:jeremy", name: "Jeremy" }
 */
export const tryExtractEspresenseDeviceLabelFromMqttEvent = (
  eventData: unknown
): { entityId: string; name?: string; alias?: string } | null => {
  if (!isRecord(eventData)) return null;

  const data = eventData as HaMqttEventData;
  const topic = asString(data.topic);
  if (!topic) return null;

  const deviceIdFromTopic = parseDeviceIdFromTopic(topic);
  if (!deviceIdFromTopic) return null;

  const payload = tryParsePayloadJson(data.payload);
  const deviceIdFromPayload = payload ? asString(payload.id) : undefined;
  const deviceId = deviceIdFromPayload ?? deviceIdFromTopic;

  const name = payload ? asString(payload.name) : undefined;

  const entityId = normalizeDeviceIdToEntityId(deviceId);
  return {
    entityId,
    name,
    alias: deviceId,
  };
};

export const __test__ = {
  normalizeDeviceIdToEntityId,
  parseDeviceIdFromTopic,
  tryParsePayloadJson,
};
