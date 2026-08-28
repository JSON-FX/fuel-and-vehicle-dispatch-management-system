import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

for (const account of [credentials.psmd, credentials.viewer, credentials.auditor]) {
  test(`${account.username} can read allocations without mutation controls`, async ({ page }) => {
    await login(page, account);
    await expect(page.getByRole('link', { name: 'Budget allocations' })).toBeVisible();
    await page.goto('/budget-allocations');
    await expect(
      page.getByRole('heading', { name: 'Budget allocations', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create allocation' })).toHaveCount(0);
    await page.getByRole('link', { name: 'View allocation' }).first().click();
    await expect(page.getByText('You have read-only access to this allocation.')).toBeVisible();
    await expect(page.getByRole('button', { name: /allocation$/ })).toHaveCount(0);

    const adminList = await page.request.get('/api/budget-allocations?mode=admin');
    expect(adminList.status()).toBe(200);
    const selector = await page.request.get('/api/budget-allocations?mode=operational');
    expect(selector.status()).toBe(200);
    const mutation = await page.request.post('/api/budget-allocations', {
      data: {},
      headers: { origin: 'http://localhost:3100', 'x-csrf-token': 'not-authorized' },
    });
    expect(mutation.status()).toBe(403);
  });
}

test('Budget Officer receives management navigation, pages, and mutation controls', async ({
  page,
}) => {
  await login(page, credentials.budgetOfficer);
  await page.goto('/budget-allocations');
  await expect(page.getByRole('button', { name: 'Create allocation' })).toBeVisible();
  await page.getByRole('link', { name: 'Manage allocation' }).first().click();
  await expect(page.getByRole('heading', { name: /Budget allocation/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /allocation$/ }).first()).toBeVisible();
});

test('dispatch-only and unauthenticated users cannot read budget allocations', async ({
  page,
  browser,
}) => {
  await login(page, credentials.standard);
  await expect(page.getByRole('link', { name: 'Budget allocations' })).toHaveCount(0);
  await page.goto('/budget-allocations');
  await expect(
    page.getByRole('heading', { name: 'Budget allocation access denied' }),
  ).toBeVisible();
  expect((await page.request.get('/api/budget-allocations?mode=admin')).status()).toBe(403);
  expect((await page.request.get('/api/budget-allocations?mode=operational')).status()).toBe(403);

  const context = await browser.newContext({ baseURL: 'http://localhost:3100' });
  expect((await context.request.get('/api/budget-allocations?mode=admin')).status()).toBe(401);
  await context.close();
});
