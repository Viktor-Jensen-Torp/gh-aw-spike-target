import { expect, test } from '@playwright/test';

test('Given I am signed out, when I open the start page directly, then I see the sign-in screen', async ({
  page,
}) => {
  await page.goto('/');
  // Should be redirected to sign-in
  await expect(page).toHaveURL('/sign-in');
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible();
});

test('Given I am signed in, when I open the start page, then I see its name', async ({
  page,
}) => {
  // First, sign up to create an account and get signed in
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Test User');
  await page.getByLabel('Email').fill(`test${Date.now()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to start page
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
});

test('Given I am signed in, when I open the start page, API running, then it shows API: ok', async ({
  page,
}) => {
  // First, sign up to create an account and get signed in
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Test User');
  await page.getByLabel('Email').fill(`test${Date.now()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to start page
  await expect(page).toHaveURL('/');
  await expect(page.getByText('API: ok')).toBeVisible();
});
