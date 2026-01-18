import type { HaCallServiceParams } from '../types/home-assistant';

/**
 * Persists Home Assistant `call_service` requests when offline/disconnected and
 * replays them once connectivity returns.
 */
export interface IHomeAssistantServiceCallQueue {
  enqueue(params: HaCallServiceParams): Promise<void>;

  /**
   * Attempts to send all queued service calls.
   *
   * Implementations should stop early if connectivity is still unavailable.
   */
  flush(): Promise<void>;
}
