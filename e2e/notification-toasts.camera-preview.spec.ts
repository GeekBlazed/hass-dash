import { expect, test } from '@playwright/test';

const OVERRIDES_STORAGE_KEY = 'hassdash:featureFlagOverrides';
const NOTIFICATION_STORE_KEY = 'hass-dash:notifications';

test.describe('notification toasts camera preview', () => {
  test('opens camera panel/modal and dismisses toast when preview is clicked', async ({ page }) => {
    await page.addInitScript(
      ({ overridesStorageKey, notificationStoreKey }) => {
        window.sessionStorage.setItem(
          overridesStorageKey,
          JSON.stringify({
            VITE_FEATURE_NOTIFICATIONS: true,
            VITE_FEATURE_NOTIFICATIONS_TOASTS: true,
            VITE_FEATURE_NOTIFICATIONS_PERSISTENT: false,
            VITE_FEATURE_NOTIFICATIONS_MOCK: false,
          })
        );

        const now = Date.now();
        window.localStorage.setItem(
          notificationStoreKey,
          JSON.stringify({
            state: {
              persistent: [],
              unreadPersistentIds: [],
              toasts: [
                {
                  id: 'toast-camera-preview-1',
                  dedupeKey: 'toast-camera-preview-1',
                  surface: 'toast',
                  source: 'test.seed',
                  action: {
                    type: 'open-camera',
                    payload: {
                      cameraEntityId: 'camera.front_door',
                      sourceEntityId: 'event.front_door_camera',
                    },
                  },
                  content: {
                    title: 'Camera Event',
                    body: 'Event detected: person_detected',
                    format: 'text',
                  },
                  createdAt: now,
                  updatedAt: now,
                  duplicateCount: 1,
                  read: true,
                  expiresAt: now + 60_000,
                },
              ],
            },
            version: 1,
          })
        );
      },
      { overridesStorageKey: OVERRIDES_STORAGE_KEY, notificationStoreKey: NOTIFICATION_STORE_KEY }
    );

    await page.goto('/');

    const previewButton = page.getByRole('button', {
      name: 'Open camera feed for camera.front_door',
    });
    await expect(previewButton).toBeVisible();

    await previewButton.click();

    await expect(page.locator('#cameras-panel')).not.toHaveClass(/is-hidden/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open camera feed for camera.front_door' })
    ).toHaveCount(0);
  });
});
