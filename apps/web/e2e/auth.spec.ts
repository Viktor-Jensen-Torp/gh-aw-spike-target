import { expect, test } from '@playwright/test';

test('Given I am on the sign-up screen, when I enter a name, a new email and "tempo2026!", and I choose "Create account", then I am signed in and see the start page', async ({
  page,
}) => {
  // Navigate to sign-up
  await page.goto('/sign-up');

  // Fill in the form
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(`mara${Date.now()}@example.com`);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');

  // Submit
  await page.getByRole('button', { name: 'Create account' }).click();

  // Should be redirected to the start page and signed in
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
  await expect(page.getByText('API: ok')).toBeVisible();
});

test('Given an account exists for mara@reyes.studio, when I sign up with MARA@reyes.studio, then the email field says "This email is already in use. Sign in instead or reset your password.", and no account is created', async ({
  page,
}) => {
  // First, create an account with mara@reyes.studio
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill('mara@reyes.studio');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to start page
  await expect(page).toHaveURL('/');

  // Go back to sign-up and try again with capitalized email
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Another Person');
  await page.getByLabel('Email').fill('MARA@reyes.studio');
  await page.getByRole('textbox', { name: 'Password' }).fill('password456');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Error message should be shown on the email field
  await expect(
    page.getByText(
      'This email is already in use. Sign in instead or reset your password.',
    ),
  ).toBeVisible();

  // Should still be on sign-up page
  await expect(page).toHaveURL('/sign-up');
});

test('Given I am on the sign-up screen, when I enter the password "short1", then the password field says "Password is too weak. Use at least 8 characters and add a number or symbol.", and no account is created', async ({
  page,
}) => {
  await page.goto('/sign-up');

  // Fill in the form with weak password
  await page.getByLabel('Full name').fill('Test User');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('short1');

  // Submit
  await page.getByRole('button', { name: 'Create account' }).click();

  // Error message should be shown on the password field
  await expect(
    page.getByText(
      'Password is too weak. Use at least 8 characters and add a number or symbol.',
    ),
  ).toBeVisible();

  // Should still be on sign-up page
  await expect(page).toHaveURL('/sign-up');
});

test('Given I am on the sign-up screen, when I choose "Sign in", then I see the sign-in screen', async ({
  page,
}) => {
  await page.goto('/sign-up');

  // Click the sign-in link in the footer
  await page.getByRole('link', { name: 'Sign in' }).click();

  // Should navigate to sign-in page
  await expect(page).toHaveURL('/sign-in');
});

test('Given an account for mara@reyes.studio with the password "tempo2026!", when I sign in with those, then I see the start page', async ({
  page,
}) => {
  const email = `mara${Date.now()}@reyes.studio`;
  // First, create the account
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to start page
  await expect(page).toHaveURL('/');

  // Now sign out and sign back in (simulate by going to sign-in page)
  await page.goto('/sign-in');

  // Sign in with the same credentials
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Should be redirected to the start page
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Tempo' })).toBeVisible();
  await expect(page.getByText('API: ok')).toBeVisible();
});

test('Given an account for mara@reyes.studio, when I sign in with a wrong password, then I see "Email or password is incorrect."', async ({
  page,
}) => {
  const email = `mara${Date.now()}@reyes.studio`;
  // First, create the account
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Mara Reyes');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('tempo2026!');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to start page
  await expect(page).toHaveURL('/');

  // Go to sign-in page
  await page.goto('/sign-in');

  // Try to sign in with wrong password
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Error message should be shown - check the last error (password field)
  await expect(
    page
      .locator('[id*="text-field-"][id*="-error"]')
      .last()
      .getByText('Email or password is incorrect.'),
  ).toBeVisible();

  // Should still be on sign-in page
  await expect(page).toHaveURL('/sign-in');
});

test('Given no account for nobody@example.com, when I sign in with it, then I see exactly the same message', async ({
  page,
}) => {
  await page.goto('/sign-in');

  // Try to sign in with non-existent email
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('anypassword');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Error message should be shown - check the last error (password field)
  await expect(
    page
      .locator('[id*="text-field-"][id*="-error"]')
      .last()
      .getByText('Email or password is incorrect.'),
  ).toBeVisible();

  // Should still be on sign-in page
  await expect(page).toHaveURL('/sign-in');
});

test('Given I am on the sign-in screen, when I choose "Create one", then I see the sign-up screen', async ({
  page,
}) => {
  await page.goto('/sign-in');

  // Click the create account link in the footer
  await page.getByRole('link', { name: 'Create one' }).click();

  // Should navigate to sign-up page
  await expect(page).toHaveURL('/sign-up');
});
