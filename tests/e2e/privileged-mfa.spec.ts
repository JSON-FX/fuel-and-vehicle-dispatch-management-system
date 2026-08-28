import { expect, test } from '@playwright/test';

import { credentials, currentTotp, login } from './fixtures/auth';

test('privileged user enrolls TOTP before a full session is issued', async ({ page, context }) => {
  await login(page, credentials.enrollment);
  await expect(page).toHaveURL(/\/mfa\/enroll$/);
  const manualSecret = (await page.locator('code').textContent())?.trim();
  expect(manualSecret).toBeTruthy();
  expect((await context.cookies()).some((cookie) => cookie.name === '__Host-fvdms_session')).toBe(
    false,
  );

  await page.getByLabel('Authenticator code').fill(currentTotp(manualSecret!));
  await page.getByRole('button', { name: 'Confirm enrollment' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('MFA enrolled')).toBeVisible();
});

test('enrolled administrator completes a recurring TOTP challenge', async ({ page }) => {
  await login(page, credentials.administrator, 30_000);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Privileged account')).toBeVisible();
});
