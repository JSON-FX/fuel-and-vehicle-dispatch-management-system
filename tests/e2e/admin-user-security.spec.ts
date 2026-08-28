import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test('administrator creates a user and explicitly acknowledges the one-time credential', async ({
  page,
}) => {
  await login(page, {
    username: credentials.administrator.username,
    password: credentials.administrator.password,
  });
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Create user' }).click();
  await page.getByLabel('Username').fill('created.e2e');
  await page.getByLabel('Email').fill('created.e2e@example.lan');
  await page.getByLabel('Full name').fill('Created E2E User');
  await page.getByRole('button', { name: 'Create user', exact: true }).last().click();

  const dialog = page.getByRole('alertdialog', { name: 'Copy the temporary password now' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close credential' })).toBeDisabled();
  await dialog.getByLabel('I have stored or delivered this password securely.').check();
  await dialog.getByRole('button', { name: 'Close credential' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('viewer receives an explicit denied state on direct administration navigation', async ({
  page,
}) => {
  await login(page, credentials.viewer);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  const response = await page.request.get('/api/users');
  expect(response.status()).toBe(403);
});
