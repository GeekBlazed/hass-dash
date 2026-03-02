import type { HaEntityId } from '../types/home-assistant';

export interface ICameraService {
  turnOn(entityIds: string | string[]): Promise<void>;
  turnOff(entityIds: string | string[]): Promise<void>;

  /**
   * Returns a live stream URL for the camera when available.
   *
   * Typically backed by the Home Assistant WebSocket command `camera/stream`.
   * The returned URL is expected to be directly loadable by the browser (e.g. includes a token).
   */
  getStreamUrl?(entityId: HaEntityId): Promise<string | null>;

  /**
   * Fetches a still image for the camera via Home Assistant's camera proxy endpoint.
   *
   * Uses the REST API path: `/api/camera_proxy/<entity_id>`.
   */
  fetchProxyImage(entityId: HaEntityId): Promise<Blob>;
}
