import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';
import { wcagAxe } from './fixtures/axe';

test('login and account pages have no automated WCAG A or AA violations', async ({ page }) => {
  await page.goto('/login');
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  await login(page, credentials.standard);
  await expect(page).toHaveURL(/\/account$/);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
});

test('authentication layout remains usable at narrow width and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('audit trail has no automated WCAG A or AA violations', async ({ page }) => {
  await login(page, credentials.auditor);
  await page.goto('/audit');
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
});

test('master-data pages remain accessible across supported responsive states', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await login(page, credentials.manager);

  for (const resource of ['offices', 'drivers', 'vehicles']) {
    await page.goto(`/admin/${resource}`);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(page.getByRole('heading', { name: new RegExp(resource, 'i') })).toBeVisible();
    await expect(page.locator('table')).toBeHidden();
    expect(await hasNoPageOverflow(page)).toBe(true);
    expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  }

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/vehicles');
    await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
    expect(await hasNoPageOverflow(page)).toBe(true);
  }

  await page.setViewportSize({ width: 750, height: 900 });
  await page.goto('/admin/offices');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByRole('heading', { name: 'Offices' })).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
});

test('budget allocations support keyboard, themes, reduced motion, zoom, and target widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await login(page, credentials.budgetOfficer);
  await page.goto('/budget-allocations');
  await page.evaluate(() => document.documentElement.classList.add('dark'));

  await expect(
    page.getByRole('heading', { name: 'Budget allocations', exact: true }),
  ).toBeVisible();
  await expect(page.locator('table')).toBeHidden();
  expect(await hasNoPageOverflow(page)).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  const create = page.getByRole('button', { name: 'Create allocation' });
  await create.click();
  const dialog = page.getByRole('dialog', { name: 'Create budget allocation' });
  await expect(dialog.getByLabel('PPMP number')).toBeFocused();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(create).toBeFocused();

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/budget-allocations');
    await expect(
      page.getByRole('heading', { name: 'Budget allocations', exact: true }),
    ).toBeVisible();
    expect(await hasNoPageOverflow(page)).toBe(true);
  }

  await page.setViewportSize({ width: 750, height: 900 });
  await page.goto('/budget-allocations');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(
    page.getByRole('heading', { name: 'Budget allocations', exact: true }),
  ).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
});

test('fuel pages remain accessible across responsive, dark, reduced-motion, and zoom states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await login(page, credentials.psmd);
  await page.goto('/fuel-issuances');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(page.getByRole('heading', { name: 'Fuel issuances', exact: true })).toBeVisible();
  await expect(page.locator('table')).toBeHidden();
  expect(await hasNoPageOverflow(page)).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  await page.goto('/fuel-issuances/new');
  await expect(page.getByRole('heading', { name: 'New fuel issuance' })).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/fuel-issuances');
    expect(await hasNoPageOverflow(page)).toBe(true);
  }

  await page.setViewportSize({ width: 750, height: 900 });
  await page.goto('/fuel-issuances/balances');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(page.getByRole('heading', { name: 'Fuel balances' })).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
});

test('dispatch pages and lifecycle dialogs remain accessible in every supported state', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await login(page, credentials.standard);
  await page.goto('/dispatches');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(
    page.getByRole('heading', { name: 'Vehicle dispatches', exact: true }),
  ).toBeVisible();
  await expect(page.locator('table')).toBeHidden();
  expect(await hasNoPageOverflow(page)).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  await page.goto('/dispatches/new');
  await expect(page.getByRole('heading', { name: 'New dispatch' })).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  const csrfToken = await readCsrfToken(page);
  const optionsResponse = await page.request.get('/api/dispatch-preparation-options');
  const options = (await optionsResponse.json()) as {
    data: {
      offices: readonly { publicId: string }[];
      drivers: readonly { publicId: string }[];
      vehicles: readonly { publicId: string }[];
    };
  };
  const created = await page.request.post('/api/dispatches', {
    data: {
      entryDate: '2026-08-29',
      travelDate: '2026-09-02',
      driverPublicId: options.data.drivers[0]!.publicId,
      vehiclePublicId: options.data.vehicles[0]!.publicId,
      requestingOfficePublicId: options.data.offices[0]!.publicId,
      destination: 'Accessibility verification route',
      purpose: 'Validate dispatch views and lifecycle dialogs',
      odoBefore: '2000.0',
      passengerCount: 2,
    },
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
  });
  expect(created.status()).toBe(201);
  const dispatchId = ((await created.json()) as { data: { publicId: string } }).data.publicId;
  await page.goto(`/dispatches/${dispatchId}`);
  await expect(
    page.getByRole('heading', { name: 'Accessibility verification route' }),
  ).toBeVisible();
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  const dispatchTrigger = page.getByRole('button', { name: 'Dispatch vehicle' });
  await dispatchTrigger.focus();
  await page.keyboard.press('Enter');
  let dialog = page.getByRole('alertdialog', { name: 'Dispatch this vehicle?' });
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Keep draft' }).click();
  await expect(dispatchTrigger).toBeFocused();

  await page.getByRole('button', { name: 'Cancel dispatch' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Cancel this dispatch?' });
  await expect(dialog.getByLabel('Reason')).toBeFocused();
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Keep dispatch' }).click();

  await dispatchTrigger.click();
  dialog = page.getByRole('alertdialog', { name: 'Dispatch this vehicle?' });
  await dialog.getByRole('button', { name: 'Confirm dispatch' }).click();
  await expect(page.getByText('Dispatched', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Complete dispatch' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Complete this dispatch?' });
  await expect(dialog.getByLabel('Final odometer (km)')).toBeFocused();
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Keep active' }).click();

  await page.getByRole('button', { name: 'Cancel dispatch' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Cancel this dispatch?' });
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  await dialog.getByRole('button', { name: 'Keep dispatch' }).click();

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dispatches');
    expect(await hasNoPageOverflow(page)).toBe(true);
    await expect(page.getByLabel('Search dispatches')).toBeVisible();
    if (width === 1440) {
      const searchBox = await page.getByLabel('Search dispatches').boundingBox();
      const statusBox = await page.getByLabel('Status').boundingBox();
      expect(searchBox?.y).toBe(statusBox?.y);
      expect(searchBox?.height).toBe(statusBox?.height);
    }
    await page.goto(
      `/dispatches/schedule?view=${width === 768 ? 'week' : 'month'}&date=2026-08-29`,
    );
    await expect(page.getByRole('heading', { name: 'Dispatch schedule' })).toBeVisible();
    expect(await hasNoPageOverflow(page)).toBe(true);
    expect((await wcagAxe(page).analyze()).violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();

  await page.setViewportSize({ width: 750, height: 900 });
  await page.goto('/dispatches');
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(
    page.getByRole('heading', { name: 'Vehicle dispatches', exact: true }),
  ).toBeVisible();
  expect(await hasNoPageOverflow(page)).toBe(true);
});

function hasNoPageOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

async function readCsrfToken(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}
