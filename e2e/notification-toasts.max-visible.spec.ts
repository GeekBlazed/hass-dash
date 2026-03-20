import { expect, test } from '@playwright/test';

const NOTIFICATION_STORE_KEY = 'hass-dash:notifications';
const ACTIVE_BOOTSTRAP_TOASTS = 2;
const configuredMaxVisible = process.env.PW_TOAST_MAX_VISIBLE;

test.describe('notification toasts max-visible config', () => {
  test('enforces visible count from config and toggles overflow indicator', async ({ page }) => {
    await page.addInitScript(({ notificationStoreKey }) => {
      const now = Date.now();
      window.localStorage.setItem(
        notificationStoreKey,
        JSON.stringify({
          state: {
            persistent: [],
            unreadPersistentIds: [],
            toasts: [
              {
                id: 'toast-max-visible-1',
                dedupeKey: 'toast-max-visible-1',
                surface: 'toast',
                source: 'test.seed',
                content: {
                  title: 'Max Visible One',
                  body: 'Toast 1',
                  format: 'text',
                },
                createdAt: now,
                updatedAt: now,
                duplicateCount: 1,
                read: true,
                expiresAt: now + 60_000,
              },
              {
                id: 'toast-max-visible-2',
                dedupeKey: 'toast-max-visible-2',
                surface: 'toast',
                source: 'test.seed',
                content: {
                  title: 'Max Visible Two',
                  body: 'Toast 2',
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
    }, { notificationStoreKey: NOTIFICATION_STORE_KEY });

    await page.goto('/');

    const popup = page.locator('.notification-toasts.modal-popup.modal-popup--top-right');
    await expect(popup).toBeVisible();

    const visibleCount = await popup.locator('.notification-toasts__item').count();
    expect(visibleCount).toBeGreaterThanOrEqual(1);
    expect(visibleCount).toBeLessThanOrEqual(ACTIVE_BOOTSTRAP_TOASTS);

    const expectedMaxVisible =
      configuredMaxVisible !== undefined ? Number(configuredMaxVisible) : undefined;
    if (
      expectedMaxVisible !== undefined &&
      Number.isFinite(expectedMaxVisible) &&
      expectedMaxVisible >= 1
    ) {
      expect(visibleCount).toBe(Math.min(expectedMaxVisible, ACTIVE_BOOTSTRAP_TOASTS));
    }

    const overflowButton = popup.getByRole('button', { name: 'Active toast count' });
    if (visibleCount < ACTIVE_BOOTSTRAP_TOASTS) {
      await expect(overflowButton).toBeVisible();
      await expect(overflowButton).toContainText(`${ACTIVE_BOOTSTRAP_TOASTS} Active`);
    } else {
      await expect(overflowButton).toHaveCount(0);
    }
  });
});
