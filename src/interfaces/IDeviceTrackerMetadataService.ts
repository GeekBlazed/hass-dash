export type DeviceTrackerMetadata = {
  /** Home Assistant device registry id (device_id), when linked. */
  deviceId?: string;
  /** Home Assistant device registry name (auto-generated) or entity-registry original name fallback. */
  name?: string;
  /** Home Assistant device registry alias (name_by_user) or entity-registry name fallback. */
  alias?: string;

  /** Resolved URL for a person/device avatar image (when available). */
  avatarUrl?: string;

  /** Uppercase initials to use when avatarUrl is not available. */
  initials?: string;
};

/**
 * Fetches Home Assistant device tracker metadata for labeling and UI.
 *
 * The returned mapping is keyed by HA entity_id (e.g. `device_tracker.phone_jeremy`).
 */
export interface IDeviceTrackerMetadataService {
  fetchByEntityId(): Promise<Record<string, DeviceTrackerMetadata>>;
}
