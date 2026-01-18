import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHomeAssistantServiceCallQueue } from '../interfaces/IHomeAssistantServiceCallQueue';
import type { HaCallServiceParams } from '../types/home-assistant';
import { idbQueueDelete, idbQueueGetAll, idbQueuePut } from '../utils/indexedDb';
import { createLogger } from '../utils/logger';

const logger = createLogger('hass-dash');

type QueuedCall = {
  id: string;
  createdAtMs: number;
  attempts: number;
  params: HaCallServiceParams;
};

function isProbablyOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('websocket') ||
    msg.includes('not connected') ||
    msg.includes('network') ||
    msg.includes('failed to fetch')
  );
}

function canUseNavigatorOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean';
}

function isBrowserOffline(): boolean {
  if (!canUseNavigatorOnline()) return false;
  return navigator.onLine === false;
}

@injectable()
export class HomeAssistantServiceCallQueue implements IHomeAssistantServiceCallQueue {
  constructor(
    @inject(TYPES.IHomeAssistantClientRaw)
    private readonly rawClient: IHomeAssistantClient
  ) {}

  async enqueue(params: HaCallServiceParams): Promise<void> {
    const now = Date.now();
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `q-${now}-${Math.random().toString(16).slice(2)}`;

    const record: QueuedCall = {
      id,
      createdAtMs: now,
      attempts: 0,
      params,
    };

    await idbQueuePut(record);
  }

  async flush(): Promise<void> {
    if (isBrowserOffline()) return;

    const all = await idbQueueGetAll<QueuedCall>();
    if (all.length === 0) return;

    all.sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const item of all) {
      if (isBrowserOffline()) return;

      try {
        await this.rawClient.callService(item.params);
        await idbQueueDelete(item.id);
      } catch (error: unknown) {
        // If we're still offline/disconnected, stop; we'll retry later.
        if (isProbablyOfflineError(error)) {
          return;
        }

        const nextAttempts = item.attempts + 1;
        await idbQueuePut({ ...item, attempts: nextAttempts });

        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Queued HA call_service failed (${nextAttempts}): ${message}`);
      }
    }
  }
}
