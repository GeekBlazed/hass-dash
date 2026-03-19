export type NotificationSurface = 'toast' | 'persistent';
export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type NotificationSourceKind = 'persistent_notification' | 'alert_state' | 'event_entity';

export type NotificationContentFormat = 'text' | 'markdown' | 'html';

export interface NotificationContent {
  title?: string;
  body: string;
  format?: NotificationContentFormat;
  imageUrl?: string;
}

export interface NotificationItem {
  id: string;
  dedupeKey: string;
  surface: NotificationSurface;
  content: NotificationContent;
  source: string;
  action?: NotificationAction;
  createdAt: number;
  updatedAt: number;
  duplicateCount: number;
  read: boolean;
  expiresAt: number | null;
}

export interface AddNotificationInput {
  dedupeKey: string;
  content: NotificationContent;
  source: string;
  action?: NotificationAction;
  ttlMs?: number;
}

export interface NotificationAction {
  type: 'open-camera' | 'focus-panel';
  payload?: Record<string, unknown>;
}

export interface NotificationStreamRecord extends AddNotificationInput {
  surface: NotificationSurface;
  sourceKind: NotificationSourceKind;
  severity?: NotificationSeverity;
  action?: NotificationAction;
  remove?: boolean;
}
