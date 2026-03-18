import { expect, test } from '@playwright/test';

const ACTIVE_BOOTSTRAP_TOASTS = 2;
const expectedMaxVisible = Number(process.env.PW_TOAST_MAX_VISIBLE ?? '1');

if (!Number.isFinite(expectedMaxVisible) || expectedMaxVisible < 1) {
  throw new Error('PW_TOAST_MAX_VISIBLE must be a positive integer for this spec.');
}

test.describe('notification toasts max-visible config', () => {
  test('enforces visible count from config and toggles overflow indicator', async ({ page }) => {
    await page.goto('/');

    const popup = page.locator('.notification-toasts.modal-popup.modal-popup--top-right');
    await expect(popup).toBeVisible();

    const expectedVisible = Math.min(expectedMaxVisible, ACTIVE_BOOTSTRAP_TOASTS);
    await expect(popup.locator('.notification-toasts__item')).toHaveCount(expectedVisible);

    const overflowButton = popup.getByRole('button', { name: 'Active toast count' });
    if (ACTIVE_BOOTSTRAP_TOASTS > expectedMaxVisible) {
      await expect(overflowButton).toBeVisible();
      await expect(overflowButton).toContainText(`${ACTIVE_BOOTSTRAP_TOASTS} Active`);
    } else {
      await expect(overflowButton).toHaveCount(0);
    }
  });
});
