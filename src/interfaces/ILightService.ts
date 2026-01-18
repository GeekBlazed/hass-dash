import type { HaEntityId } from '../types/home-assistant';

export interface ILightService {
  turnOn(entityIds: HaEntityId | HaEntityId[]): Promise<void>;
  turnOff(entityIds: HaEntityId | HaEntityId[]): Promise<void>;
}
