import { expect, test } from '@playwright/test';

import type { ExportJobDto } from '@/application/reporting/dto/export-job-dtos';

import { credentials, login } from './fixtures/auth';
import { wcagAxe } from './fixtures/axe';

test.describe.serial('operational reports and private exports', () => {
  test('shows authorized overview and complete responsive dispatch details', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await login(page, credentials.standard);
    await page.goto('/reports?periodType=MONTHLY&referenceDate=2026-08-29');
    await page.evaluate(() => document.documentElement.classList.add('dark'));

    await expect(page.getByRole('heading', { name: 'Operational reports' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operational overview' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Dispatch count by office', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Vehicle utilization', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Fuel consumption by office', exact: true }),
    ).toHaveCount(0);
    expect(await hasNoPageOverflow(page)).toBe(true);
    expect((await wcagAxe(page).analyze()).violations).toEqual([]);

    await page.goto(
      '/reports?report=DISPATCH&periodType=CUSTOM&startDate=2026-08-01&endDate=2026-08-31',
    );
    await expect(page.getByRole('heading', { name: 'Dispatch detail' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Archived District Warehouse', level: 3 }),
    ).toBeVisible();
    await expect(page.locator('table')).toBeHidden();
    expect(await hasNoPageOverflow(page)).toBe(true);

    for (const width of [768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        '/reports?report=DISPATCH&periodType=CUSTOM&startDate=2026-08-01&endDate=2026-08-31',
      );
      await expect(page.getByRole('heading', { name: 'Dispatch detail' })).toBeVisible();
      expect(await hasNoPageOverflow(page)).toBe(true);
    }

    await page.setViewportSize({ width: 750, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(await hasNoPageOverflow(page)).toBe(true);
  });

  test('creates, downloads, and rejects replay of a private synchronous workbook', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await login(page, credentials.standard);
    await page.goto(
      '/reports?report=DISPATCH&periodType=CUSTOM&startDate=2026-08-01&endDate=2026-08-31',
    );

    await page.getByRole('button', { name: 'Export XLSX' }).click();
    const dialog = page.getByRole('dialog', { name: 'Export Dispatch detail' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('100,000 rows')).toBeVisible();
    await expect(dialog.getByText('50 MiB')).toBeVisible();
    const creation = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/api/report-exports'),
    );
    await dialog.getByRole('button', { name: 'Request export' }).click();
    expect((await creation).status()).toBe(201);
    await expect(dialog.getByText('The workbook is ready in recent exports.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    const recent = page.getByRole('region', { name: 'Recent exports' });
    await expect(recent.getByText('Completed')).toBeVisible();
    const downloadEvent = page.waitForEvent('download');
    await recent.getByRole('button', { name: 'Download' }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/dispatch-.*\.xlsx/);
    const replay = await page.request.get(download.url());
    expect(replay.status()).toBe(404);
  });

  test('queues every annual workbook and publishes it through the worker', async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, credentials.standard);
    const csrfToken = await readCsrfToken(page);
    const requested = await page.request.post('/api/report-exports', {
      data: {
        reportType: 'DISPATCH',
        periodType: 'ANNUAL',
        referenceDate: '2026-08-29',
      },
      headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
    });
    expect(requested.status()).toBe(202);
    const queued = await readApiData<ExportJobDto>(requested);
    expect(queued).toMatchObject({ mode: 'QUEUED', status: 'QUEUED' });
    expect(queued).not.toHaveProperty('storageKey');

    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/report-exports/${queued.publicId}`);
        if (!response.ok()) return `HTTP_${response.status()}`;
        return (await readApiData<ExportJobDto>(response)).status;
      })
      .toBe('COMPLETED');
  });

  test('shows clear invalid and filtered-empty states', async ({ page }) => {
    await login(page, credentials.standard);
    await page.goto('/reports?periodType=MONTHLY&periodType=ANNUAL');
    await expect(page.getByRole('heading', { name: 'Invalid report filters' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear filters' })).toBeVisible();

    await page.goto(
      '/reports?report=DISPATCH&periodType=CUSTOM&startDate=2020-01-01&endDate=2020-01-02',
    );
    await expect(page.getByRole('heading', { name: 'No matching report activity' })).toBeVisible();
  });

  test('publishes request, completion, and download authorization audit evidence', async ({
    page,
  }) => {
    await login(page, credentials.auditor);
    for (const action of [
      'report.export.requested',
      'report.export.completed',
      'report.export.download_authorized',
    ]) {
      await expect
        .poll(async () => {
          await page.goto(`/audit?action=${action}`);
          return page.locator('table tbody tr').count();
        })
        .toBeGreaterThan(0);
    }
  });
});

function hasNoPageOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

async function readCsrfToken(page: import('@playwright/test').Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return (await readApiData<{ readonly csrfToken: string }>(response)).csrfToken;
}

async function readApiData<T>(response: import('@playwright/test').APIResponse): Promise<T> {
  return ((await response.json()) as { readonly data: T }).data;
}
