import { expect, test } from '@playwright/test';

test.describe('notification toasts regression', () => {
  test('renders modal-popup shell, overflow indicator, and dismiss behavior', async ({ page }) => {
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

    if (afterDismissCount < 2 && afterDismissCount > 0) {
      await expect(popup.getByRole('button', { name: 'Active toast count' })).toHaveCount(0);
    }
  });
});
