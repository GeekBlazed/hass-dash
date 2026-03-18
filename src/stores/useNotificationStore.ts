import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

import type { AddNotificationInput, NotificationItem } from '../types/notifications';

const DEFAULT_TOAST_TTL_SECONDS = 20;
const DEFAULT_MAX_VISIBLE_TOASTS = 3;

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const parseToastTtlMs = (): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_TOAST_TTL_SECONDS;
  const fallback = DEFAULT_TOAST_TTL_SECONDS;
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback * 1000;
  }
  return Math.floor(parsed * 1000);
};

export const parseMaxVisibleToasts = (): number => {
  const raw = import.meta.env.VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE;
  const parsed = Number(raw ?? DEFAULT_MAX_VISIBLE_TOASTS);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MAX_VISIBLE_TOASTS;
  }

  return Math.floor(parsed);
};

const sanitizeUnread = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  return ids.filter((v): v is string => typeof v === 'string');
};

type NotificationStore = {
  toasts: NotificationItem[];
  persistent: NotificationItem[];
  unreadPersistentIds: string[];

  addToast: (input: AddNotificationInput) => void;
  dismissToast: (id: string) => void;
  pruneExpiredToasts: (now?: number) => void;

  addPersistent: (input: AddNotificationInput) => void;
  markPersistentRead: (id: string) => void;
  markAllPersistentRead: () => void;
  seedMockPersistent: (items: ReadonlyArray<AddNotificationInput>) => void;
  clearPersistent: () => void;

  getVisibleToasts: (now?: number) => NotificationItem[];
};

function mergeOrInsertNotification(
  items: NotificationItem[],
  next: AddNotificationInput,
  now: number,
  surface: 'toast' | 'persistent',
  ttlMs: number | null
): NotificationItem[] {
  const idx = items.findIndex((item) => item.dedupeKey === next.dedupeKey);
  if (idx >= 0) {
    const updated: NotificationItem = {
      ...items[idx],
      content: next.content,
      source: next.source,
      updatedAt: now,
      duplicateCount: items[idx].duplicateCount + 1,
      expiresAt: surface === 'toast' ? now + (ttlMs ?? 0) : null,
    };

    const clone = items.slice();
    clone[idx] = updated;
    return clone;
  }

  const created: NotificationItem = {
    id: randomId(),
    dedupeKey: next.dedupeKey,
    surface,
    content: next.content,
    source: next.source,
    createdAt: now,
    updatedAt: now,
    duplicateCount: 1,
    read: surface === 'toast',
    expiresAt: surface === 'toast' ? now + (ttlMs ?? 0) : null,
  };

  return [created, ...items];
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set, get) => ({
        toasts: [],
        persistent: [],
        unreadPersistentIds: [],

        addToast: (input) => {
          const now = Date.now();
          const ttlMs = input.ttlMs ?? parseToastTtlMs();

          set((state) => ({
            toasts: mergeOrInsertNotification(state.toasts, input, now, 'toast', ttlMs),
          }));
        },

        dismissToast: (id) => {
          set((state) => ({
            toasts: state.toasts.filter((item) => item.id !== id),
          }));
        },

        pruneExpiredToasts: (now = Date.now()) => {
          set((state) => ({
            toasts: state.toasts.filter((item) => item.expiresAt === null || item.expiresAt > now),
          }));
        },

        addPersistent: (input) => {
          const now = Date.now();

          set((state) => {
            const persistent = mergeOrInsertNotification(
              state.persistent,
              input,
              now,
              'persistent',
              null
            );
            const latest = persistent[0];
            if (!latest) return { persistent };

            const unread = state.unreadPersistentIds.includes(latest.id)
              ? state.unreadPersistentIds
              : [latest.id, ...state.unreadPersistentIds];

            return {
              persistent,
              unreadPersistentIds: unread,
            };
          });
        },

        markPersistentRead: (id) => {
          set((state) => ({
            unreadPersistentIds: state.unreadPersistentIds.filter((v) => v !== id),
            persistent: state.persistent.map((item) =>
              item.id === id
                ? {
                    ...item,
                    read: true,
                  }
                : item
            ),
          }));
        },

        markAllPersistentRead: () => {
          set((state) => ({
            unreadPersistentIds: [],
            persistent: state.persistent.map((item) => ({ ...item, read: true })),
          }));
        },

        seedMockPersistent: (items) => {
          if (get().persistent.length > 0) return;

          for (const item of items) {
            get().addPersistent(item);
          }
        },

        clearPersistent: () => {
          set({
            persistent: [],
            unreadPersistentIds: [],
          });
        },

        getVisibleToasts: (now = Date.now()) => {
          const active = get().toasts.filter(
            (item) => item.expiresAt === null || item.expiresAt > now
          );
          return active.slice(0, parseMaxVisibleToasts());
        },
      }),
      {
        name: 'hass-dash:notifications',
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          persistent: state.persistent,
          unreadPersistentIds: state.unreadPersistentIds,
        }),
        migrate: (persistedState) => {
          const s = (persistedState ?? {}) as {
            persistent?: NotificationItem[];
            unreadPersistentIds?: unknown;
          };

          return {
            persistent: Array.isArray(s.persistent) ? s.persistent : [],
            unreadPersistentIds: sanitizeUnread(s.unreadPersistentIds),
            toasts: [],
          };
        },
      }
    )
  )
);
