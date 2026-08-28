import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

for (const account of [credentials.viewer, credentials.auditor, credentials.budgetOfficer]) {
  test(`${account.username} receives read-only fuel access`, async ({ page }) => {
    await login(page, account);
    await expect(page.getByRole('link', { name: 'Fuel issuances', exact: true })).toBeVisible();
    await page.goto('/fuel-issuances');
    await expect(page.getByRole('heading', { name: 'Fuel issuances', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New fuel issuance' })).toHaveCount(0);
    expect((await page.request.get('/api/fuel-issuances')).status()).toBe(200);
    expect(
      (
        await page.request.get('/api/fuel-balances?startDate=2026-08-01&endDate=2026-08-31')
      ).status(),
    ).toBe(200);
    const denied = await page.request.post('/api/fuel-issuances', {
      data: {},
      headers: { origin: 'http://localhost:3100', 'x-csrf-token': 'not-authorized' },
    });
    expect(denied.status()).toBe(403);
  });
}

test('PSMD staff can create and post but cannot void', async ({ page }) => {
  await login(page, credentials.psmd);
  await page.goto('/fuel-issuances');
  await expect(page.getByRole('link', { name: 'New fuel issuance' })).toBeVisible();
  const denied = await page.request.post(
    '/api/fuel-issuances/019c043f-422c-7141-8a03-a9d9bda3544d/void',
    {
      data: { reason: 'Unauthorized void attempt' },
      headers: { origin: 'http://localhost:3100', 'x-csrf-token': 'not-authorized' },
    },
  );
  expect(denied.status()).toBe(403);
});

test('dispatch-only and unauthenticated users cannot read fuel records', async ({
  page,
  browser,
}) => {
  await login(page, credentials.standard);
  await expect(page.getByRole('link', { name: 'Fuel issuances', exact: true })).toHaveCount(0);
  await page.goto('/fuel-issuances');
  await expect(page.getByRole('heading', { name: 'Fuel issuance access denied' })).toBeVisible();
  expect((await page.request.get('/api/fuel-issuances')).status()).toBe(403);
  const context = await browser.newContext({ baseURL: 'http://localhost:3100' });
  expect((await context.request.get('/api/fuel-issuances')).status()).toBe(401);
  await context.close();
});
