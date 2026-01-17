import type { HaEntityId } from '../types/home-assistant';

/**
 * Resolves Home Assistant entity ids by Home Assistant label name.
 *
 * Labels live in Home Assistant's label/entity registries (not in `state_changed`).
 * This service uses the registry APIs exposed by the HA WebSocket client.
 */
export interface IEntityLabelService {
  getEntityIdsByLabelName(labelName: string): Promise<Set<HaEntityId>>;
}
