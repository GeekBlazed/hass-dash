import { inject, injectable } from 'inversify';

import { TYPES } from '../core/types';
import type { IHomeAssistantClient } from '../interfaces/IHomeAssistantClient';
import type { ILightService } from '../interfaces/ILightService';
import type { HaEntityId } from '../types/home-assistant';

@injectable()
export class HomeAssistantLightService implements ILightService {
  constructor(
    @inject(TYPES.IHomeAssistantClient)
    private readonly homeAssistantClient: IHomeAssistantClient
  ) {}

  async turnOn(entityIds: HaEntityId | HaEntityId[]): Promise<void> {
    await this.callLightService('turn_on', entityIds);
  }

  async turnOff(entityIds: HaEntityId | HaEntityId[]): Promise<void> {
    await this.callLightService('turn_off', entityIds);
  }

  private async callLightService(
    service: 'turn_on' | 'turn_off',
    entityIds: HaEntityId | HaEntityId[]
  ): Promise<void> {
    const targetEntityIds = Array.isArray(entityIds) ? entityIds : [entityIds];

    await this.homeAssistantClient.connect();
    await this.homeAssistantClient.callService({
      domain: 'light',
      service,
      service_data: {
        entity_id: targetEntityIds,
      },
      target: {
        entity_id: targetEntityIds,
      },
    });
  }
}
