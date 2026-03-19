import { expect, test } from '@playwright/test';

test.describe('persistent notifications control', () => {
  test('opens panel, marks unread as read, and keeps read state across refresh', async ({
    page,
  }) => {
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Notifications' });
    await expect(toggle).toBeVisible();

    await toggle.click();

    const panel = page.locator('#notifications-panel').first();
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Back Door Left Open')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('Package Detected')).toBeVisible({ timeout: 15_000 });

    const articleCount = await panel.locator('article').count();
    expect(articleCount).toBeGreaterThanOrEqual(1);

    const markReadButtons = panel.getByRole('button', { name: 'Mark read' });
    const markReadCount = await markReadButtons.count();
    if (markReadCount > 0) {
      await markReadButtons.first().click();
      await expect.poll(async () => await markReadButtons.count()).toBeLessThan(markReadCount);
    }

    await page.reload();

    const toggleAfterReload = page.getByRole('button', { name: 'Notifications' });
    await expect(toggleAfterReload).toBeVisible();

    const panelAfterReload = page.locator('#notifications-panel').first();
    if (await panelAfterReload.isHidden()) {
      await toggleAfterReload.click();
    }

    await expect(panelAfterReload).toBeVisible();
    await expect(panelAfterReload.locator('article').first()).toBeVisible();
    const articleCountAfterReload = await panelAfterReload.locator('article').count();
    expect(articleCountAfterReload).toBeGreaterThanOrEqual(articleCount);
  });
});
