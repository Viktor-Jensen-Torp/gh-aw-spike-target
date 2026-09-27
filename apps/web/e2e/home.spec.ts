import { expect, test } from '@playwright/test';

test('Given I open Tempo, then I see its name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
});

test('Given I open the start page and the API is running, then I see "API: ok"', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('API: ok')).toBeVisible();
});
