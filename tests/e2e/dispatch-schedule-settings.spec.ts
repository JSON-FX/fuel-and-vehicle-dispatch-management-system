import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test('Dispatch Officer cannot read global dispatch settings', async ({ page }) => {
  await login(page, credentials.standard);
  expect((await page.request.get('/api/dispatch-schedule-settings')).status()).toBe(403);
});

test('schedule policy is globally administered with explicit confirmation', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, credentials.enrollment);
  await page.goto('/admin/dispatch-settings');
  await expect(page.getByRole('heading', { name: 'Dispatch settings', exact: true })).toBeVisible();
  await page.getByLabel('Block conflicting dispatches').check();
  const save = page.getByRole('button', { name: 'Save policy' });
  await save.click();
  await expect(
    page.getByText('Confirm that conflicting dispatches should be blocked before saving.'),
  ).toBeVisible();
  await page
    .getByLabel('I understand that all detected same-day conflicts will be blocked.')
    .check();
  await save.click();
  await expect(page.getByText('Global dispatch schedule policy updated.')).toBeVisible();

  const current = await page.request.get('/api/dispatch-schedule-settings');
  expect((await current.json()) as { data: { policy: string } }).toMatchObject({
    data: { policy: 'BLOCK' },
  });

  const csrfToken = await readCsrfToken(page);
  const reset = await page.request.patch('/api/dispatch-schedule-settings', {
    data: { policy: 'WARN_AND_ACK' },
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
  });
  expect(reset.status()).toBe(200);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}
