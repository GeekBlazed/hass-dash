import { expect, test } from '@playwright/test';

const OVERRIDES_STORAGE_KEY = 'hassdash:featureFlagOverrides';
const NOTIFICATION_STORE_KEY = 'hass-dash:notifications';

test.describe('persistent notification rich content sanitization', () => {
  test('sanitizes unsafe html content while rendering rich content', async ({ page }) => {
    await page.addInitScript(
      ({ overridesStorageKey, notificationStoreKey }) => {
        window.sessionStorage.setItem(
          overridesStorageKey,
          JSON.stringify({
            VITE_FEATURE_NOTIFICATIONS_MOCK: false,
            VITE_FEATURE_NOTIFICATIONS_PERSISTENT: true,
            VITE_FEATURE_NOTIFICATIONS: true,
          })
        );

        const now = Date.now();
        window.localStorage.setItem(
          notificationStoreKey,
          JSON.stringify({
            state: {
              persistent: [
                {
                  id: 'unsafe-1',
                  dedupeKey: 'unsafe-1',
                  surface: 'persistent',
                  source: 'test.seed',
                  content: {
                    title: 'Unsafe Sample',
                    body: '<script>window.__xss = true</script><a href="javascript:alert(1)">Click me</a><img src="https://example.com/pic.jpg" srcdoc="x" onerror="alert(1)" />',
                    format: 'html',
                  },
                  createdAt: now,
                  updatedAt: now,
                  duplicateCount: 1,
                  read: false,
                  expiresAt: null,
                },
              ],
              unreadPersistentIds: ['unsafe-1'],
              toasts: [],
            },
            version: 1,
          })
        );
      },
      { overridesStorageKey: OVERRIDES_STORAGE_KEY, notificationStoreKey: NOTIFICATION_STORE_KEY }
    );

    await page.goto('/');

    const control = page.locator('section[aria-label="Persistent notifications"]').first();
    await expect(control).toBeVisible();

    await control.getByRole('button', { name: 'Notifications' }).click();

    const panel = page.locator('#persistent-notifications-panel').first();
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Unsafe Sample')).toBeVisible();

    // Sanitizer should strip script nodes and unsafe href/srcdoc attributes.
    await expect(panel.locator('script')).toHaveCount(0);

    const link = panel.locator('a').first();
    await expect(link).toBeVisible();
    await expect(link).not.toHaveAttribute('href', /javascript:/i);

    const img = panel.locator('img').first();
    await expect(img).toBeVisible();
    await expect(img).not.toHaveAttribute('srcdoc', /.*/);
  });
});
