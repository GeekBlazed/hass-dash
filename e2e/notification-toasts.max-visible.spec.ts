import { expect, test } from '@playwright/test';

const ACTIVE_BOOTSTRAP_TOASTS = 2;
const configuredMaxVisible = process.env.PW_TOAST_MAX_VISIBLE;

test.describe('notification toasts max-visible config', () => {
  test('enforces visible count from config and toggles overflow indicator', async ({ page }) => {
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
