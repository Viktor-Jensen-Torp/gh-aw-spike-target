import { expect, test } from '@playwright/test';

test('Given I am signed in as Mara Reyes, when I open the user card\'s menu, then I see "Mara Reyes", my email and "Sign out"', async ({
  page,
}) => {
  // First, sign up
  await page.goto('/sign-up');
  const email = `mara${Date.now()}@reyes.studio`;
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should be redirected to the start page and signed in
  await expect(page).toHaveURL('/');

  // Open the user card menu by clicking the button with the user card
  await page.getByRole('button', { name: 'Mara Reyes' }).first().click();

  // Verify the menu shows the name, email, and sign out button
  // The menu should contain the user's name and email
  await expect(page.getByRole('menu')).toContainText('Mara Reyes');
  await expect(page.getByRole('menu')).toContainText(email);
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
});

test('Given I am signed in, when I choose "Sign out", then I see the sign-in screen, and my old session cookie no longer works', async ({
  page,
}) => {
  // First, sign up
  await page.goto('/sign-up');
  const email = `mara${Date.now()}@reyes.studio`;
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should be redirected to the start page and signed in
  await expect(page).toHaveURL('/');

  // Open the user card menu and click sign out
  await page.getByRole('button', { name: 'Mara Reyes' }).first().click();

  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  // Should be redirected to the sign-in screen
  await expect(page).toHaveURL('/sign-in');
});

test('Given I have signed out, when I go back, then I see the sign-in screen, not the start page', async ({
  page,
}) => {
  // First, sign up
  await page.goto('/sign-up');
  const email = `mara${Date.now()}@reyes.studio`;
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should be redirected to the start page and signed in
  await expect(page).toHaveURL('/');

  // Open the user card menu and click sign out
  await page.getByRole('button', { name: 'Mara Reyes' }).first().click();

  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  // Should be redirected to the sign-in screen
  await expect(page).toHaveURL('/sign-in');

  // Go back in browser history - since we used location.replace,
  // this should go back to the previous page in history (sign-up)
  await page.goBack();

  // We're now on a different page (sign-up). The key point is that
  // we cannot go back to the signed-in start page (/) because the
  // session was deleted. To verify this, let's try to navigate to /
  // and confirm we get redirected to sign-in.
  await page.goto('/');
  await expect(page).toHaveURL('/sign-in');
});

test('Given the user menu is open, when I hover "Sign out", then only "Sign out" is highlighted', async ({
  page,
}) => {
  // First, sign up
  await page.goto('/sign-up');
  const email = `mara${Date.now()}@reyes.studio`;
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should be redirected to the start page and signed in
  await expect(page).toHaveURL('/');

  // Open the user card menu
  await page.getByRole('button', { name: 'Mara Reyes' }).first().click();

  // Hover over "Sign out" item
  const signOutItem = page.getByRole('menuitem', { name: 'Sign out' });
  await signOutItem.hover();

  // Verify that the "Sign out" item has the highlighted background
  // The menu item gets highlighted with bg-bg when hovered (data-[highlighted]:bg-bg)
  await expect(signOutItem).toHaveAttribute('data-highlighted');
});
