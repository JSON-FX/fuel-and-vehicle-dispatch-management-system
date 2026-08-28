import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test('read-only user can use operational selectors without administration access', async ({
  page,
}) => {
  await login(page, credentials.viewer);
  await expect(page.getByRole('link', { name: 'Offices' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Drivers' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Vehicles' })).toHaveCount(0);

  for (const resource of ['offices', 'drivers', 'vehicles']) {
    await page.goto(`/admin/${resource}`);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();

    const adminList = await page.request.get(`/api/${resource}?mode=admin`);
    expect(adminList.status()).toBe(403);

    const mutation = await page.request.post(`/api/${resource}`, {
      data: {},
      headers: { origin: 'http://localhost:3100', 'x-csrf-token': 'not-authorized' },
    });
    expect(mutation.status()).toBe(403);

    const selector = await page.request.get(`/api/${resource}?mode=operational&pageSize=200`);
    expect(selector.status()).toBe(200);
  }

  const drivers = await page.request.get('/api/drivers?mode=operational&pageSize=200');
  const body = (await drivers.json()) as {
    readonly data: { readonly items: readonly Readonly<Record<string, unknown>>[] };
  };
  expect(body.data.items.length).toBeGreaterThan(0);
  for (const item of body.data.items) expect(item).not.toHaveProperty('contactNumber');
  expect(JSON.stringify(body)).not.toContain('+63 917 000');
});

test('dispatch user receives only the selectors assigned to its role', async ({ page }) => {
  await login(page, credentials.standard);
  expect((await operationalSelector(page, 'drivers')).status()).toBe(200);
  expect((await operationalSelector(page, 'vehicles')).status()).toBe(200);
  expect((await operationalSelector(page, 'offices')).status()).toBe(403);
});

test('unauthenticated master-data requests require a session', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:3100' });
  const request = context.request;
  expect((await request.get('/api/offices?mode=operational')).status()).toBe(401);
  expect((await request.get('/api/drivers?mode=operational')).status()).toBe(401);
  expect((await request.get('/api/vehicles?mode=operational')).status()).toBe(401);
  await context.close();
});

function operationalSelector(page: Page, resource: string) {
  return page.request.get(`/api/${resource}?mode=operational`);
}
