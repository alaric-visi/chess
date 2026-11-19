import { expect, test } from '@playwright/test';

// A browser with WebGL switched off (or a GPU it refuses to use).
test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } });

test('the board area explains the problem instead of crashing the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: '3D view unavailable' })).toBeVisible();
  // The rest of the app still works.
  await expect(page.getByRole('button', { name: 'New game' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
});
