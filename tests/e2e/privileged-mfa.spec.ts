import { expect, test } from '@playwright/test';

import { credentials, currentTotp, login } from './fixtures/auth';

test('administrator enables MFA globally before a privileged user enrolls', async ({
  page,
  context,
}) => {
  await login(page, credentials.enrollment);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('MFA not required')).toBeVisible();

  await page.goto('/admin/security');
  const mfaSetting = page.getByRole('switch', { name: 'Require authenticator codes' });
  await expect(mfaSetting).not.toBeChecked();
  await mfaSetting.check();
  await expect(page.getByText('Multi-factor authentication is enabled')).toBeVisible();
  await page.getByRole('button', { name: 'Save security setting' }).click();
  await expect(page).toHaveURL(/\/login$/);

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

  await disableMfa(page);
});

test('enrolled administrator completes a recurring TOTP challenge', async ({ page }) => {
  await login(page, {
    username: credentials.administrator.username,
    password: credentials.administrator.password,
  });
  await page.goto('/admin/security');
  const mfaSetting = page.getByRole('switch', { name: 'Require authenticator codes' });
  await expect(mfaSetting).not.toBeChecked();
  await mfaSetting.check();
  await page.getByRole('button', { name: 'Save security setting' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await login(page, credentials.administrator, 30_000);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Privileged account')).toBeVisible();

  await disableMfa(page);
});

async function disableMfa(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/security');
  const mfaSetting = page.getByRole('switch', { name: 'Require authenticator codes' });
  await expect(mfaSetting).toBeChecked();
  await mfaSetting.uncheck();
  await page.getByRole('button', { name: 'Save security setting' }).click();
  await expect(page.getByText('Authentication settings saved.')).toBeVisible();
  await expect(page.getByText('Multi-factor authentication is disabled')).toBeVisible();
}
