import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseMaxVisibleToasts, useNotificationStore } from './useNotificationStore';

const resetNotificationStore = () => {
  useNotificationStore.persist.clearStorage();
  useNotificationStore.setState({
    toasts: [],
    persistent: [],
    unreadPersistentIds: [],
  });
};

describe('useNotificationStore', () => {
  beforeEach(() => {
    resetNotificationStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('dedupes toast notifications by dedupe key and increments duplicate count', () => {
    const state = useNotificationStore.getState();

    state.addToast({
      dedupeKey: 'light:office:on',
      source: 'test',
      content: { title: 'Light On', body: 'Office light is now ON' },
      ttlMs: 5000,
    });

    state.addToast({
      dedupeKey: 'light:office:on',
      source: 'test',
      content: { title: 'Light On', body: 'Office light is now ON' },
      ttlMs: 5000,
    });

    const toasts = useNotificationStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.duplicateCount).toBe(2);
  });

  it('caps visible toasts to 3 items (newest first)', () => {
    const state = useNotificationStore.getState();

    for (let i = 0; i < 5; i += 1) {
      state.addToast({
        dedupeKey: `toast-${i}`,
        source: 'test',
        content: { title: `Toast ${i}`, body: `Body ${i}` },
        ttlMs: 30000,
      });
    }

    const visible = useNotificationStore.getState().getVisibleToasts();
    expect(visible).toHaveLength(3);
    expect(visible[0]?.content.title).toBe('Toast 4');
    expect(visible[2]?.content.title).toBe('Toast 2');
  });

  it('tracks unread persistent notifications and can mark all as read', () => {
    const state = useNotificationStore.getState();

    state.addPersistent({
      dedupeKey: 'persistent-1',
      source: 'test',
      content: { title: 'One', body: 'One body' },
    });

    state.addPersistent({
      dedupeKey: 'persistent-2',
      source: 'test',
      content: { title: 'Two', body: 'Two body' },
    });

    expect(useNotificationStore.getState().unreadPersistentIds).toHaveLength(2);

    state.markAllPersistentRead();

    expect(useNotificationStore.getState().unreadPersistentIds).toHaveLength(0);
    expect(useNotificationStore.getState().persistent.every((item) => item.read)).toBe(true);
  });

  it('dismisses and prunes toasts correctly', () => {
    const state = useNotificationStore.getState();
    const baseNow = Date.now();

    state.addToast({
      dedupeKey: 'toast-1',
      source: 'test',
      content: { title: 'One', body: 'Body one' },
      ttlMs: 1,
    });

    state.addToast({
      dedupeKey: 'toast-2',
      source: 'test',
      content: { title: 'Two', body: 'Body two' },
      ttlMs: 60_000,
    });

    const firstId = useNotificationStore.getState().toasts[0]?.id;
    if (!firstId) throw new Error('Expected first toast id to exist');

    state.dismissToast(firstId);
    expect(useNotificationStore.getState().toasts).toHaveLength(1);

    state.pruneExpiredToasts(baseNow + 120_000);
    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('supports explicit ttl override and default ttl fallback', () => {
    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_TTL_SECONDS', '0');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const state = useNotificationStore.getState();

    state.addToast({
      dedupeKey: 'toast-explicit',
      source: 'test',
      content: { title: 'Explicit', body: 'Body' },
      ttlMs: 5_000,
    });

    state.addToast({
      dedupeKey: 'toast-default',
      source: 'test',
      content: { title: 'Default', body: 'Body' },
    });

    const toasts = useNotificationStore.getState().toasts;
    const explicit = toasts.find((t) => t.dedupeKey === 'toast-explicit');
    const fallback = toasts.find((t) => t.dedupeKey === 'toast-default');

    expect(explicit?.expiresAt).toBe(Date.now() + 5_000);
    // Invalid env (0) falls back to default 20s.
    expect(fallback?.expiresAt).toBe(Date.now() + 20_000);

    vi.useRealTimers();
  });

  it('retains toast action payload for UI action handling', () => {
    const state = useNotificationStore.getState();

    state.addToast({
      dedupeKey: 'camera-event',
      source: 'event.state_changed',
      content: { title: 'Camera', body: 'Event detected: person_detected' },
      action: {
        type: 'open-camera',
        payload: { cameraEntityId: 'camera.studio_camera' },
      },
      ttlMs: 60_000,
    });

    const toast = useNotificationStore.getState().toasts[0];
    expect(toast?.action).toEqual({
      type: 'open-camera',
      payload: { cameraEntityId: 'camera.studio_camera' },
    });
  });

  it('dedupes persistent notifications and can mark one as read', () => {
    const state = useNotificationStore.getState();

    state.addPersistent({
      dedupeKey: 'persistent-dedupe',
      source: 'test',
      content: { title: 'One', body: 'Body one' },
    });
    state.addPersistent({
      dedupeKey: 'persistent-dedupe',
      source: 'test',
      content: { title: 'Two', body: 'Body two' },
    });

    const persistent = useNotificationStore.getState().persistent;
    expect(persistent).toHaveLength(1);
    expect(persistent[0]?.duplicateCount).toBe(2);

    const itemId = persistent[0]?.id;
    if (!itemId) throw new Error('Expected persistent notification id to exist');

    state.markPersistentRead(itemId);
    const updated = useNotificationStore.getState().persistent[0];
    expect(updated?.read).toBe(true);
    expect(useNotificationStore.getState().unreadPersistentIds).toHaveLength(0);
  });

  it('seeds mock persistent only when empty and can clear all persistent state', () => {
    const state = useNotificationStore.getState();

    state.seedMockPersistent([
      {
        dedupeKey: 'seed-1',
        source: 'test',
        content: { title: 'Seed 1', body: 'Body' },
      },
    ]);
    expect(useNotificationStore.getState().persistent).toHaveLength(1);

    state.seedMockPersistent([
      {
        dedupeKey: 'seed-2',
        source: 'test',
        content: { title: 'Seed 2', body: 'Body' },
      },
    ]);
    expect(useNotificationStore.getState().persistent).toHaveLength(1);

    state.clearPersistent();
    expect(useNotificationStore.getState().persistent).toHaveLength(0);
    expect(useNotificationStore.getState().unreadPersistentIds).toHaveLength(0);
  });

  it('uses default max visible toasts when env is missing or invalid', () => {
    vi.unstubAllEnvs();
    expect(parseMaxVisibleToasts()).toBe(3);

    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE', '0');
    expect(parseMaxVisibleToasts()).toBe(3);

    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE', 'not-a-number');
    expect(parseMaxVisibleToasts()).toBe(3);
  });

  it('uses floored env max visible toast value when valid', () => {
    vi.stubEnv('VITE_NOTIFICATIONS_TOAST_MAX_VISIBLE', '4.9');
    expect(parseMaxVisibleToasts()).toBe(4);
  });

  it('migrate() hydrates explicit toast fixtures in dev mode and filters invalid entries', () => {
    vi.stubEnv('DEV', true);

    const options = useNotificationStore.persist.getOptions();
    const migrate = options.migrate as unknown as (persistedState: unknown) => {
      toasts: Array<{ dedupeKey: string }>;
      persistent: unknown[];
      unreadPersistentIds: string[];
    };

    const migrated = migrate({
      persistent: [],
      unreadPersistentIds: [],
      toasts: [
        {
          id: 'toast-1',
          dedupeKey: 'toast-1',
          surface: 'toast',
          source: 'fixture.seed',
          content: { body: 'fixture body' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          duplicateCount: 1,
          read: true,
          expiresAt: Date.now() + 60_000,
        },
        {
          id: 'invalid-toast',
          dedupeKey: 'invalid-toast',
          surface: 'toast',
          source: 'fixture.seed',
          content: { body: 'missing required shape' },
        },
      ],
    });

    expect(migrated.toasts).toHaveLength(1);
    expect(migrated.toasts[0]?.dedupeKey).toBe('toast-1');
  });

  it('migrate() toast fixture hydration follows current DEV mode', () => {
    const options = useNotificationStore.persist.getOptions();
    const migrate = options.migrate as unknown as (persistedState: unknown) => {
      toasts: unknown[];
    };

    const migrated = migrate({
      toasts: [
        {
          id: 'toast-1',
          dedupeKey: 'toast-1',
          surface: 'toast',
          source: 'fixture.seed',
          content: { body: 'fixture body' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          duplicateCount: 1,
          read: true,
          expiresAt: Date.now() + 60_000,
        },
      ],
    });

    if (import.meta.env.DEV) {
      expect(migrated.toasts).toHaveLength(1);
    } else {
      expect(migrated.toasts).toEqual([]);
    }
  });
});
