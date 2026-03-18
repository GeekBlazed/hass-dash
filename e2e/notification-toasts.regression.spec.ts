import { expect, test } from '@playwright/test';

test.describe('notification toasts regression', () => {
  test('renders modal-popup shell, overflow indicator, and dismiss behavior', async ({ page }) => {
    await page.goto('/');

    const popup = page.locator('.notification-toasts.modal-popup.modal-popup--top-right');
    await expect(popup).toBeVisible();

    await expect(popup.getByText('Notifications')).toBeVisible();
    await expect(popup.locator('.notification-toasts__item')).toHaveCount(1);

    const overflowButton = popup.getByRole('button', { name: 'Active toast count' });
    await expect(overflowButton).toBeVisible();
    await expect(overflowButton).toContainText('2 Active');

    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;

    expect(box.y).toBeLessThan(60);
    expect(viewport.width - (box.x + box.width)).toBeLessThan(60);

    await popup.getByRole('button', { name: 'Dismiss' }).click();

    await expect(popup.locator('.notification-toasts__item')).toHaveCount(1);
    await expect(popup.getByRole('button', { name: 'Active toast count' })).toHaveCount(0);
  });
});
