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
