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
}
