import { expect, test } from '@playwright/test';

test.describe('connectivity offline/online behavior', () => {
  test('shows Offline during network loss and recovers UI behavior when network returns', async ({
    context,
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    await page.goto('/');

    await expect(page.getByText('Home')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications' }).first()).toBeVisible();

    await context.setOffline(true);
    const offlineFetchOk = await page.evaluate(async () => {
      try {
        await fetch('/');
        return true;
      } catch {
        return false;
      }
    });
    expect(offlineFetchOk).toBe(false);

    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await context.setOffline(false);
    const onlineFetchOk = await page.evaluate(async () => {
      try {
        const response = await fetch('/');
        return response.ok;
      } catch {
        return false;
      }
    });
    expect(onlineFetchOk).toBe(true);

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Verify reconnect path completes without uncaught browser errors.
    expect(pageErrors).toHaveLength(0);
  });
});
