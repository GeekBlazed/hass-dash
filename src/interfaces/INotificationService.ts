import type { NotificationStreamRecord } from '../types/notifications';
import type { IHaSubscription } from './IHomeAssistantClient';

export interface INotificationService {
  subscribe(handler: (record: NotificationStreamRecord) => void): Promise<IHaSubscription>;
}
