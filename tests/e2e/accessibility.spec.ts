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

function hasNoPageOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}
