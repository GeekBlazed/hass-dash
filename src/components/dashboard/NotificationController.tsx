import { useEffect, useRef } from 'react';

import { TYPES } from '../../core/types';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { useService } from '../../hooks/useService';
import type { INotificationService } from '../../interfaces/INotificationService';
import { useEntityStore } from '../../stores/useEntityStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import type { AddNotificationInput, NotificationStreamRecord } from '../../types/notifications';

const bootstrapMockNotifications = (): AddNotificationInput[] => [
  {
    dedupeKey: 'mock-door-left-open',
    source: 'mock.bootstrap',
    content: {
      title: 'Back Door Left Open',
      body: 'Back door has been open for 8 minutes. Please check if this is expected.',
      format: 'text',
    },
  },
  {
    dedupeKey: 'mock-camera-package',
    source: 'mock.bootstrap',
    content: {
      title: 'Package Detected',
      body: 'Front porch camera reported a package event at **09:14 AM**.',
      format: 'markdown',
      imageUrl: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=600',
    },
  },
  {
    dedupeKey: 'mock-hvac-filter',
    source: 'mock.bootstrap',
    content: {
      title: 'HVAC Maintenance Reminder',
      body: '<strong>Filter replacement</strong> is due this week. <em>Tap for checklist.</em>',
      format: 'html',
    },
  },
];

const displayNameFromEntity = (
  attrs: Record<string, unknown> | undefined,
  entityId: string
): string => {
  const friendlyName = typeof attrs?.friendly_name === 'string' ? attrs.friendly_name.trim() : '';
  if (friendlyName.length > 0) return friendlyName;

  const name = typeof attrs?.name === 'string' ? attrs.name.trim() : '';
  if (name.length > 0) return name;

  return entityId;
};

export function NotificationController() {
  const notificationService = useService<INotificationService>(TYPES.INotificationService);

  const { isEnabled: notificationsEnabled } = useFeatureFlag('NOTIFICATIONS');
  const { isEnabled: toastsEnabled } = useFeatureFlag('NOTIFICATIONS_TOASTS');
  const { isEnabled: persistentEnabled } = useFeatureFlag('NOTIFICATIONS_PERSISTENT');

  const entitiesById = useEntityStore((s) => s.entitiesById);

  const addToast = useNotificationStore((s) => s.addToast);
  const addPersistent = useNotificationStore((s) => s.addPersistent);
  const removePersistentByDedupeKey = useNotificationStore((s) => s.removePersistentByDedupeKey);
  const seedMockPersistent = useNotificationStore((s) => s.seedMockPersistent);

  const lightStatesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!notificationsEnabled) return;

    let active = true;
    let unsubscribe: (() => Promise<void>) | null = null;

    const handleRecord = (record: NotificationStreamRecord) => {
      if (record.surface === 'persistent') {
        if (!persistentEnabled) return;

        if (record.remove) {
          removePersistentByDedupeKey(record.dedupeKey);
          return;
        }

        addPersistent(record);
        return;
      }

      if (!toastsEnabled) return;
      addToast(record);
    };

    void notificationService
      .subscribe(handleRecord)
      .then((sub) => {
        if (!active) {
          void sub.unsubscribe();
          return;
        }
        unsubscribe = sub.unsubscribe;
      })
      .catch(() => {
        // Keep the dashboard resilient even if notification stream subscription fails.
      });

    return () => {
      active = false;
      if (unsubscribe) {
        void unsubscribe();
      }
    };
  }, [
    addPersistent,
    addToast,
    notificationService,
    notificationsEnabled,
    persistentEnabled,
    removePersistentByDedupeKey,
    toastsEnabled,
  ]);

  useEffect(() => {
    if (!notificationsEnabled || !persistentEnabled) return;

    const raw = import.meta.env.VITE_FEATURE_NOTIFICATIONS_MOCK;
    const enabledByDefault = import.meta.env.DEV ? 'true' : 'false';
    const mockEnabled = String(raw ?? enabledByDefault).toLowerCase() === 'true';

    if (!mockEnabled) return;

    seedMockPersistent(bootstrapMockNotifications());

    if (import.meta.env.DEV) {
      addPersistent({
        dedupeKey: 'mock-system-ready',
        source: 'mock.bootstrap',
        content: {
          title: 'Notification Bootstrap Ready',
          body: 'Mock persistent notifications are enabled while live Home Assistant streams are under discovery.',
          format: 'text',
        },
      });
    }
  }, [addPersistent, notificationsEnabled, persistentEnabled, seedMockPersistent]);

  useEffect(() => {
    if (!notificationsEnabled || !toastsEnabled) return;

    const previous = lightStatesRef.current;

    for (const [entityId, state] of Object.entries(entitiesById)) {
      if (!entityId.startsWith('light.')) continue;

      const nextValue = String(state.state).trim().toLowerCase();
      const prevValue = previous[entityId];
      previous[entityId] = nextValue;

      // Seed local baseline from current entity snapshot without emitting toasts.
      if (prevValue === undefined) continue;
      if (prevValue === nextValue) continue;
      if (nextValue !== 'on' && nextValue !== 'off') continue;

      const name = displayNameFromEntity(state.attributes as Record<string, unknown>, entityId);

      addToast({
        dedupeKey: `light:${entityId}:${nextValue}`,
        source: 'light.state_changed',
        content: {
          title: nextValue === 'on' ? 'Light Turned On' : 'Light Turned Off',
          body: `${name} is now ${nextValue.toUpperCase()}.`,
          format: 'text',
        },
      });
    }
  }, [addToast, entitiesById, notificationsEnabled, toastsEnabled]);

  return null;
}
