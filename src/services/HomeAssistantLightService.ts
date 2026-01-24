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

  async setBrightness(entityId: HaEntityId, brightness: number): Promise<void> {
    await this.callLightService('turn_on', entityId, { brightness });
  }

  async setColorTemperature(entityId: HaEntityId, mireds: number): Promise<void> {
    await this.callLightService('turn_on', entityId, { color_temp: mireds });
  }

  async setRgbColor(entityId: HaEntityId, rgb: readonly [number, number, number]): Promise<void> {
    await this.callLightService('turn_on', entityId, { rgb_color: [...rgb] });
  }

  private async callLightService(
    service: 'turn_on' | 'turn_off',
    entityIds: HaEntityId | HaEntityId[],
    serviceData?: Record<string, unknown>
  ): Promise<void> {
    const targetEntityIds = Array.isArray(entityIds) ? entityIds : [entityIds];

    await this.homeAssistantClient.connect();
    await this.homeAssistantClient.callService({
      domain: 'light',
      service,
      service_data: {
        entity_id: targetEntityIds,
        ...(serviceData ?? {}),
      },
      target: {
        entity_id: targetEntityIds,
      },
    });
  }
}
