import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IEntityService } from '../interfaces/IEntityService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type {
  HaEntityState,
  HaStateChangedEventData,
  HaTriggerEvent,
} from '../types/home-assistant';

@injectable()
export class HomeAssistantEntityService implements IEntityService {
  private readonly haClient: IHomeAssistantClient;

  // Multiplex `state_changed` events to avoid creating multiple HA subscriptions.
  // Multiple server-side subscriptions can duplicate event traffic and cause HA to log:
  // "Client unable to keep up with pending messages. Reached 4096 pending messages".
  private readonly stateChangedHandlers = new Set<(newState: HaEntityState) => void>();
  private stateChangedSubscription: { unsubscribe: () => Promise<void> } | null = null;
  private stateChangedSubscribePromise: Promise<void> | null = null;

  constructor(@inject(TYPES.IHomeAssistantClient) haClient: IHomeAssistantClient) {
    this.haClient = haClient;
  }

  private isRetryableDisconnectError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.trim().toLowerCase();
    return (
      msg === 'websocket disconnected' ||
      msg === 'websocket is not connected' ||
      msg === 'home assistant client is not connected'
    );
  }

  private async ensureConnected(): Promise<void> {
    if (!this.haClient.isConnected()) {
      await this.haClient.connect();
    }
  }

  private async ensureStateChangedSubscription(): Promise<void> {
    if (this.stateChangedSubscription) return;
    if (this.stateChangedSubscribePromise) return this.stateChangedSubscribePromise;

    this.stateChangedSubscribePromise = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await this.ensureConnected();

          const sub = await this.haClient.subscribeToEvents<HaStateChangedEventData>(
            'state_changed',
            (event) => {
              const next = event.data?.new_state;
              if (!next) return;

              // Copy to array to avoid iteration issues if handlers unsubscribe during dispatch.
              const handlers = Array.from(this.stateChangedHandlers);
              for (const handler of handlers) {
                try {
                  handler(next);
                } catch {
                  // Never let a consumer break the subscription pipeline.
                }
              }
            }
          );

          this.stateChangedSubscription = sub;

          // If everyone unsubscribed while the subscription was being established,
          // clean up immediately to avoid leaving a hot subscription running.
          if (this.stateChangedHandlers.size === 0) {
            this.stateChangedSubscription = null;
            try {
              await sub.unsubscribe();
            } catch {
              // ignore
            }
          }

          return;
        } catch (error) {
          if (attempt === 0 && this.isRetryableDisconnectError(error)) {
            continue;
          }
          throw error;
        }
      }

      throw new Error('Failed to subscribe to Home Assistant state changes.');
    })();

    try {
      await this.stateChangedSubscribePromise;
    } finally {
      this.stateChangedSubscribePromise = null;
    }
  }

  async fetchStates(): Promise<HaEntityState[]> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.ensureConnected();

        const states = await this.haClient.getStates();
        if (!states) {
          throw new Error('Home Assistant returned an empty response for get_states');
        }
        return states;
      } catch (error) {
        if (attempt === 0 && this.isRetryableDisconnectError(error)) {
          // transient disconnect between connect() and get_states; retry once
          continue;
        }

        const wsMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch Home Assistant states via WebSocket (get_states): ${wsMessage}.`
        );
      }
    }

    throw new Error('Failed to fetch Home Assistant states via WebSocket (get_states).');
  }

  async subscribeToStateChanges(
    handler: (newState: HaEntityState) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    this.stateChangedHandlers.add(handler);
    await this.ensureStateChangedSubscription();

    return {
      unsubscribe: async () => {
        this.stateChangedHandlers.delete(handler);

        if (this.stateChangedHandlers.size > 0) return;

        // If a subscribe is still in-flight, wait for it to settle before attempting cleanup.
        if (this.stateChangedSubscribePromise) {
          try {
            await this.stateChangedSubscribePromise;
          } catch {
            // ignore; subscription never established
          }
        }

        const sub = this.stateChangedSubscription;
        this.stateChangedSubscription = null;

        if (!sub) return;
        try {
          await sub.unsubscribe();
        } catch {
          // ignore
        }
      },
    };
  }

  async subscribeToStateChangesFiltered(
    entityIds: ReadonlyArray<string>,
    handler: (newState: HaEntityState) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    await this.ensureConnected();

    if (!this.haClient.subscribeToTrigger) {
      // Fallback: subscribe to state_changed and filter client-side.
      const allow = new Set(entityIds);
      return this.subscribeToStateChanges((next) => {
        if (!allow.has(next.entity_id)) return;
        handler(next);
      });
    }

    const triggers = entityIds.map((entityId) => ({
      platform: 'state',
      entity_id: entityId,
    }));

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await this.ensureConnected();

          return await this.haClient.subscribeToTrigger(triggers, (event: HaTriggerEvent) => {
            const next = event.variables?.trigger?.to_state;
            if (!next) return;
            handler(next);
          });
        } catch (error: unknown) {
          if (attempt === 0 && this.isRetryableDisconnectError(error)) {
            continue;
          }
          throw error;
        }
      }

      throw new Error('Failed to subscribe to Home Assistant triggers.');
    } catch (error: unknown) {
      // Some Home Assistant setups/tokens do not allow subscribe_trigger and return
      // an Unauthorized error. Fall back to state_changed filtering so the UI stays functional.
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      const message = error instanceof Error ? error.message : String(error);

      const isUnauthorized =
        code === 'unauthorized' || message.trim().toLowerCase() === 'unauthorized';

      if (!isUnauthorized) {
        throw error;
      }

      const allow = new Set(entityIds);
      return this.subscribeToStateChanges((next) => {
        if (!allow.has(next.entity_id)) return;
        handler(next);
      });
    }
  }
}
