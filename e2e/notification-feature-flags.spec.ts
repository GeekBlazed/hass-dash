import { expect, test } from '@playwright/test';

const OVERRIDES_STORAGE_KEY = 'hassdash:featureFlagOverrides';

test.describe('notification feature flags', () => {
  test('hides persistent notifications surface when persistent flag is disabled', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ overridesStorageKey }) => {
        window.sessionStorage.setItem(
          overridesStorageKey,
          JSON.stringify({
            VITE_FEATURE_NOTIFICATIONS: true,
            VITE_FEATURE_NOTIFICATIONS_TOASTS: true,
            VITE_FEATURE_NOTIFICATIONS_PERSISTENT: false,
          })
        );
      },
      { overridesStorageKey: OVERRIDES_STORAGE_KEY }
    );

    await page.goto('/');

    await expect(page.locator('section[aria-label="Persistent notifications"]')).toHaveCount(0);

    // The flag should only hide persistent notifications surface; toast presence
    // depends on runtime events and is intentionally not required here.
    await expect(page.getByRole('button', { name: 'Notifications' }).first()).toBeVisible();
  });
});
