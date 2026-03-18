export type NotificationSurface = 'toast' | 'persistent';

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
  ttlMs?: number;
}
