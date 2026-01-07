import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IEntityService } from '../interfaces/IEntityService';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { IHttpClient } from '../interfaces/IHttpClient';
import type { HaEntityState, HaStateChangedEventData } from '../types/home-assistant';

@injectable()
export class HomeAssistantEntityService implements IEntityService {
  private readonly httpClient: IHttpClient;
  private readonly haClient: IHomeAssistantClient;

  constructor(
    @inject(TYPES.IHttpClient) httpClient: IHttpClient,
    @inject(TYPES.IHomeAssistantClient) haClient: IHomeAssistantClient
  ) {
    this.httpClient = httpClient;
    this.haClient = haClient;
  }

  async fetchStates(): Promise<HaEntityState[]> {
    // REST endpoint: GET /api/states
    const states = await this.httpClient.get<HaEntityState[]>('/api/states');
    if (!states) {
      throw new Error('Home Assistant returned an empty response for GET /api/states');
    }
    return states;
  }

  async subscribeToStateChanges(
    handler: (newState: HaEntityState) => void
  ): Promise<{ unsubscribe: () => Promise<void> }> {
    if (!this.haClient.isConnected()) {
      await this.haClient.connect();
    }

    return this.haClient.subscribeToEvents<HaStateChangedEventData>('state_changed', (event) => {
      const data = event.data;
      const next = data?.new_state;
      if (!next) return;
      handler(next);
    });
  }
}
