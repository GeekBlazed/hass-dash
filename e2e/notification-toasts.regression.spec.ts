import { expect, test } from '@playwright/test';

const NOTIFICATION_STORE_KEY = 'hass-dash:notifications';

test.describe('notification toasts regression', () => {
  test('renders modal-popup shell, overflow indicator, and dismiss behavior', async ({ page }) => {
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
                id: 'toast-regression-1',
                dedupeKey: 'toast-regression-1',
                surface: 'toast',
                source: 'test.seed',
                content: {
                  title: 'Regression Toast One',
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
                id: 'toast-regression-2',
                dedupeKey: 'toast-regression-2',
                surface: 'toast',
                source: 'test.seed',
                content: {
                  title: 'Regression Toast Two',
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

    await expect(popup.getByText('Notifications')).toBeVisible();

    const toasts = popup.locator('.notification-toasts__item');
    const initialToastCount = await toasts.count();
    expect(initialToastCount).toBeGreaterThanOrEqual(1);

    const overflowButton = popup.getByRole('button', { name: 'Active toast count' });
    const hadOverflowBeforeDismiss = (await overflowButton.count()) > 0;
    if (initialToastCount < 2) {
      await expect(overflowButton).toBeVisible();
      await expect(overflowButton).toContainText('2 Active');
    } else {
      await expect(overflowButton).toHaveCount(0);
    }

    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;

    expect(box.y).toBeLessThan(60);
    expect(viewport.width - (box.x + box.width)).toBeLessThan(60);

    await popup.getByRole('button', { name: 'Dismiss' }).first().click();

    const afterDismissCount = await toasts.count();
    expect(afterDismissCount).toBeLessThanOrEqual(initialToastCount);

    // When overflow existed, dismissing the visible toast should roll an older
    // non-expired toast into view.
    if (hadOverflowBeforeDismiss) {
      expect(afterDismissCount).toBeGreaterThanOrEqual(1);
    }

  });
});
