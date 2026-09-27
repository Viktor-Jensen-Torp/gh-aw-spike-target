import { expect, test } from '@playwright/test';

test('Given I open Tempo, then I see its name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
});
