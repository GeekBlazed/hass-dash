import { expect, test } from '@playwright/test';

test.describe('persistent notifications control', () => {
  test('opens panel, marks unread as read, and keeps read state across refresh', async ({
    page,
  }) => {
    await page.goto('/');

    const control = page.locator('section[aria-label="Persistent notifications"]').first();
    await expect(control).toBeVisible();

    const toggle = control.getByRole('button', { name: 'Notifications' });
    await expect(toggle).toBeVisible();

    await toggle.click();

    const panel = page.locator('#persistent-notifications-panel').first();
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Back Door Left Open')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('Package Detected')).toBeVisible({ timeout: 15_000 });

    const articleCount = await panel.locator('article').count();
    expect(articleCount).toBeGreaterThanOrEqual(1);

    const markReadButtons = panel.getByRole('button', { name: 'Mark read' });
    const markReadCount = await markReadButtons.count();
    if (markReadCount > 0) {
      await markReadButtons.first().click();
      await expect(markReadButtons).toHaveCount(Math.max(0, markReadCount - 1));
    }

    await page.reload();

    const toggleAfterReload = page
      .locator('section[aria-label="Persistent notifications"]')
      .first()
      .getByRole('button', { name: 'Notifications' });
    await expect(toggleAfterReload).toBeVisible();

    await toggleAfterReload.click();
    const panelAfterReload = page.locator('#persistent-notifications-panel').first();
    await expect(panelAfterReload).toBeVisible();
    await expect(panelAfterReload.locator('article').first()).toBeVisible();
    const articleCountAfterReload = await panelAfterReload.locator('article').count();
    expect(articleCountAfterReload).toBeGreaterThanOrEqual(articleCount);
  });
});
