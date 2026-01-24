import type { HaEntityId } from '../types/home-assistant';

export interface ILightService {
  turnOn(entityIds: HaEntityId | HaEntityId[]): Promise<void>;
  turnOff(entityIds: HaEntityId | HaEntityId[]): Promise<void>;

  setBrightness(entityId: HaEntityId, brightness: number): Promise<void>;
  setColorTemperature(entityId: HaEntityId, mireds: number): Promise<void>;
  setRgbColor(entityId: HaEntityId, rgb: readonly [number, number, number]): Promise<void>;
}
