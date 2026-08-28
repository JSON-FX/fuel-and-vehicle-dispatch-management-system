import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test('standard user can sign in and logout invalidates protected navigation', async ({
  page,
  context,
}) => {
  await login(page, credentials.standard);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();

  const session = (await context.cookies()).find(
    (cookie) => cookie.name === '__Host-fvdms_session',
  );
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });

  await page.goto('/account?view=security');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);
});

test('temporary credential requires a password change before account access', async ({ page }) => {
  await login(page, credentials.forced);
  await expect(page).toHaveURL(/\/password-change$/);
  await page
    .getByRole('textbox', { name: 'New password', exact: true })
    .fill(credentials.forced.replacement);
  await page.getByLabel('Confirm new password').fill(credentials.forced.replacement);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Password current')).toBeVisible();
});

test('login form supports keyboard flow and generic invalid-credential feedback', async ({
  page,
}) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Username')).toBeFocused();
  await page.getByLabel('Username').fill('missing.user');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Password', exact: true })).toBeFocused();
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'username or password is invalid' }),
  ).toBeVisible();
});
