import type { HaEntityState } from '../types/home-assistant';
import type { IHaSubscription } from './IHomeAssistantClient';

export interface IEntityService {
  /**
   * Fetches the current snapshot of all entity states.
   */
  fetchStates(): Promise<HaEntityState[]>;

  /**
   * Subscribes to Home Assistant `state_changed` events and emits the `new_state`.
   */
  subscribeToStateChanges(handler: (newState: HaEntityState) => void): Promise<IHaSubscription>;

  /**
   * Subscribes to state changes for a specific set of entities.
   *
   * Implementations may use `subscribe_trigger` to reduce event volume vs.
   * subscribing to all `state_changed` events.
   */
  subscribeToStateChangesFiltered?(
    entityIds: ReadonlyArray<string>,
    handler: (newState: HaEntityState) => void
  ): Promise<IHaSubscription>;
}
