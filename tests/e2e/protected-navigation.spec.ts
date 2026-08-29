import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';
import { wcagAxe } from './fixtures/axe';

test('desktop sidebar groups destinations and identifies the current page', async ({ page }) => {
  await login(page, credentials.manager);
  await page.goto('/admin/drivers');

  const sidebar = page.getByRole('complementary', { name: 'Application navigation' });
  await expect(sidebar).toBeVisible();
  await expect(page.locator('header').filter({ hasText: 'FVDMS' })).toBeHidden();

  const masterData = sidebar.locator('details').filter({ hasText: 'Master data' });
  await expect(masterData).toHaveAttribute('open', '');
  await expect(sidebar.getByRole('link', { name: 'Drivers' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(sidebar.getByRole('link', { name: 'Users' })).toHaveCount(0);

  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await expect(sidebar).toHaveCSS('width', '72px');
  await expect(sidebar.getByRole('link', { name: 'Drivers' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Drivers' })).toHaveAttribute('title', 'Drivers');

  await sidebar.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(sidebar.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  await expect(sidebar).toHaveCSS('width', '272px');
});

test('mobile drawer supports keyboard dismissal, focus return, and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, credentials.manager);

  const openNavigation = page.getByRole('button', { name: 'Open navigation' });
  await expect(openNavigation).toBeVisible();
  await openNavigation.click();

  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(openNavigation).toBeFocused();

  await openNavigation.click();
  await drawer.getByText('Master data', { exact: true }).click();
  await drawer.getByRole('link', { name: 'Drivers' }).click();
  await expect(page).toHaveURL(/\/admin\/drivers$/);
  await expect(drawer).toBeHidden();
  expect(await hasNoPageOverflow(page)).toBe(true);
});

test('reports stays grouped under Oversight in expanded and collapsed navigation', async ({
  page,
}) => {
  await login(page, credentials.standard);
  await page.goto('/reports');
  const sidebar = page.getByRole('complementary', { name: 'Application navigation' });
  await expect(sidebar.getByRole('link', { name: 'Reports' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(sidebar.getByText('Oversight', { exact: true })).toBeVisible();
  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(sidebar.getByRole('link', { name: 'Reports' })).toHaveAttribute('title', 'Reports');
});

function hasNoPageOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}
