import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test('dispatch and fuel staff receive only their report families and export permissions', async ({
  page,
}) => {
  await login(page, credentials.standard);
  await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible();
  expect((await page.request.get(detailUrl('DISPATCH'))).status()).toBe(200);
  expect((await page.request.get(detailUrl('FUEL_ISSUANCE'))).status()).toBe(403);

  await page.goto('/reports?report=DISPATCH&periodType=MONTHLY&referenceDate=2026-08-29');
  await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();

  await signOut(page);
  await login(page, credentials.psmd);
  expect((await page.request.get(detailUrl('FUEL_ISSUANCE'))).status()).toBe(200);
  expect((await page.request.get(detailUrl('DISPATCH'))).status()).toBe(403);
  await page.goto('/reports?report=FUEL_ISSUANCE&periodType=MONTHLY&referenceDate=2026-08-29');
  await expect(page.getByRole('button', { name: 'Export XLSX' })).toBeVisible();
  const fuelExport = await page.request.post('/api/report-exports', {
    data: {
      reportType: 'FUEL_ISSUANCE',
      periodType: 'MONTHLY',
      referenceDate: '2026-08-29',
    },
    headers: {
      origin: 'http://localhost:3100',
      'x-csrf-token': await readCsrfToken(page),
    },
  });
  expect(fuelExport.status()).toBe(201);
  expect((await fuelExport.json()) as object).toMatchObject({
    data: { reportType: 'FUEL_ISSUANCE', status: 'COMPLETED' },
  });
  await page.goto(
    '/reports?report=BUDGET_ALLOCATION_ACTIVITY&periodType=MONTHLY&referenceDate=2026-08-29',
  );
  await expect(page.getByRole('button', { name: 'Export XLSX' })).toHaveCount(0);
});

test('viewers remain read-only and system administrators have no implicit report access', async ({
  page,
}) => {
  await login(page, credentials.viewer);
  await page.goto('/reports?report=DISPATCH&periodType=MONTHLY&referenceDate=2026-08-29');
  await expect(page.getByRole('heading', { name: 'Dispatch detail' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export XLSX' })).toHaveCount(0);
  const csrfToken = await readCsrfToken(page);
  const deniedExport = await page.request.post('/api/report-exports', {
    data: {
      reportType: 'DISPATCH',
      periodType: 'MONTHLY',
      referenceDate: '2026-08-29',
    },
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
  });
  expect(deniedExport.status()).toBe(403);

  await signOut(page);
  await login(page, credentials.enrollment);
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Report access denied' })).toBeVisible();
});

test('report APIs reject unauthenticated, duplicate, unknown, and client-owned fields', async ({
  page,
  browser,
}) => {
  await login(page, credentials.standard);
  expect(
    (
      await page.request.get('/api/reports/DISPATCH?periodType=MONTHLY&periodType=ANNUAL&owner=10')
    ).status(),
  ).toBe(400);
  const csrfToken = await readCsrfToken(page);
  const clientOwned = await page.request.post('/api/report-exports', {
    data: {
      reportType: 'DISPATCH',
      periodType: 'MONTHLY',
      referenceDate: '2026-08-29',
      requesterUserId: '10',
      storageKey: '/tmp/report.xlsx',
    },
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
  });
  expect(clientOwned.status()).toBe(400);
  expect(
    (
      await page.request.post('/api/report-exports', {
        data: {
          reportType: 'DISPATCH',
          periodType: 'MONTHLY',
          referenceDate: '2026-08-29',
        },
        headers: { origin: 'http://localhost:3100' },
      })
    ).status(),
  ).toBe(403);

  const context = await browser.newContext({ baseURL: 'http://localhost:3100' });
  expect((await context.request.get(detailUrl('DISPATCH'))).status()).toBe(401);
  expect((await context.request.get('/api/report-exports')).status()).toBe(401);
  await context.close();
});

function detailUrl(reportType: 'DISPATCH' | 'FUEL_ISSUANCE'): string {
  return `/api/reports/${reportType}?periodType=MONTHLY&referenceDate=2026-08-29`;
}

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}

async function signOut(page: Page): Promise<void> {
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
}
