import type { HaEntityId } from '../types/home-assistant';

/**
 * Provides the set of Home Assistant entities that are labeled "Household".
 *
 * Note: Home Assistant entity labels live in the entity registry, not in
 * `state_changed` events. Consumers should query this service and use the
 * resulting set to prefer/filter entity state updates.
 */
export interface IHouseholdEntityLabelService {
  getHouseholdEntityIds(): Promise<Set<HaEntityId>>;
}
