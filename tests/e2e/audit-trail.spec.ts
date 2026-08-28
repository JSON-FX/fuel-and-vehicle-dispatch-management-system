import { expect, test } from '@playwright/test';

import { credentials, login } from './fixtures/auth';
import { wcagAxe } from './fixtures/axe';

test('audit trail supports filters, cursor navigation, details, and access evidence', async ({
  page,
}) => {
  await login(page, credentials.auditor);
  await expect(page.getByRole('link', { name: 'Audit trail' })).toBeVisible();
  await page.goto('/audit?action=audit.seed.recorded');
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  await expect(page.getByText('Latest verification: Passed')).toBeVisible();

  const firstPageSequences = await page.locator('table tbody tr td:nth-child(6)').allTextContents();
  expect(firstPageSequences).toHaveLength(50);
  await page.getByRole('link', { name: 'Next events' }).click();
  await expect(page).toHaveURL(/cursor=/);
  const secondPageSequences = await page
    .locator('table tbody tr td:nth-child(6)')
    .allTextContents();
  expect(secondPageSequences.length).toBeGreaterThan(0);
  const overlap = firstPageSequences.filter((sequence) => secondPageSequences.includes(sequence));
  expect(overlap).toEqual([]);

  await page.goto('/audit?action=audit.seed.recorded');
  await page.getByLabel('Action').fill('audit.seed.recorded');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/action=audit(?:\.|%2E)seed(?:\.|%2E)recorded/);
  await page.getByRole('link', { name: 'View event' }).first().click();
  await expect(page).toHaveURL(/\/audit\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Audit event', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sensitive event context' })).toBeVisible();
  await expect(page.locator('main script')).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to audit trail' }).click();
  await expect
    .poll(async () => {
      await page.goto('/audit?action=audit.accessed');
      return page.locator('table tbody tr').count();
    })
    .toBeGreaterThan(0);
});

test('audit detail protects sensitive context with a separate permission', async ({ page }) => {
  await login(page, credentials.auditReader);
  await page.goto('/audit?action=audit.seed.recorded');
  await page.getByRole('link', { name: 'View event' }).first().click();

  await expect(page.getByText('Sensitive request context is hidden')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sensitive event context' })).toHaveCount(0);
});

test('audit denial hides navigation, protects page and API, and records evidence', async ({
  page,
  browser,
}) => {
  await login(page, credentials.viewer);
  await expect(page.getByRole('link', { name: 'Audit trail' })).toHaveCount(0);
  await page.goto('/audit');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  expect((await page.request.get('/api/audit-events')).status()).toBe(403);

  const auditorContext = await browser.newContext({ baseURL: 'http://localhost:3100' });
  const auditorPage = await auditorContext.newPage();
  await login(auditorPage, credentials.auditor);
  await expect
    .poll(async () => {
      await auditorPage.goto('/audit?action=auth.authorization.denied');
      return auditorPage.locator('table tbody tr').count();
    })
    .toBeGreaterThan(0);
  await auditorContext.close();
});

test('audit trail explains empty and invalid query states', async ({ page }) => {
  await login(page, credentials.auditor);
  await page.goto('/audit?action=audit.no_match');
  await expect(page.getByRole('heading', { name: 'No matching audit events' })).toBeVisible();

  await page.goto('/audit?action=INVALID');
  await expect(page.locator('[data-slot="alert"]')).toContainText('audit filters are invalid');
  await expect(page.getByLabel('Action')).toHaveValue('INVALID');

  await page.goto('/audit?cursor=invalid');
  await expect(page.locator('[data-slot="alert"]')).toContainText('pagination cursor is invalid');
});

test('audit trail remains accessible with keyboard, zoom, themes, and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await login(page, credentials.auditor);
  await page.goto('/audit');

  await page.getByLabel('From').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'To', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Action', exact: true })).toBeFocused();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 640, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect((await wcagAxe(page).analyze()).violations).toEqual([]);

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible();
  }
});
