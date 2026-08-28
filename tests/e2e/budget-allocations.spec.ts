import { expect, test, type APIResponse, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
  readonly error?: {
    readonly details?: readonly { readonly field?: string; readonly reason: string }[];
  };
}

interface AllocationRecord {
  readonly publicId: string;
  readonly ppmpNumber: string;
  readonly status: string;
}

test.describe.serial('budget allocation management', () => {
  test('operational selector enforces period, status, lifecycle, and office state', async ({
    page,
  }) => {
    await login(page, credentials.budgetOfficer);

    const current = await page.request.get(
      '/api/budget-allocations?mode=operational&effectiveDate=2026-08-28&pageSize=200',
    );
    expect(current.ok()).toBe(true);
    const currentBody = JSON.stringify(await current.json());
    expect(currentBody).toContain('E2E-OPERATIONAL-CURRENT');
    for (const excluded of [
      'E2E-DRAFT-CURRENT',
      'E2E-CLOSED-CURRENT',
      'E2E-CANCELLED-CURRENT',
      'E2E-ACTIVE-FUTURE',
      'E2E-ACTIVE-INACTIVE-OFFICE',
      'E2E-DELETED-ACTIVE',
    ]) {
      expect(currentBody).not.toContain(excluded);
    }

    const future = await page.request.get(
      '/api/budget-allocations?mode=operational&effectiveDate=2026-10-01&pageSize=200',
    );
    expect(future.ok()).toBe(true);
    const futureBody = JSON.stringify(await future.json());
    expect(futureBody).toContain('E2E-ACTIVE-FUTURE');
    expect(futureBody).not.toContain('E2E-OPERATIONAL-CURRENT');
  });

  test('Budget Officer completes draft, active, terminal, deletion, and restore flows', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page, credentials.budgetOfficer);
    await expect(page.getByRole('link', { name: 'Budget allocations' })).toBeVisible();
    await page.goto('/budget-allocations');

    const firstTrigger = page.getByRole('button', { name: 'Create allocation' });
    await firstTrigger.click();
    let dialog = page.getByRole('dialog', { name: 'Create budget allocation' });
    await expect(dialog.getByLabel('PPMP number')).toBeFocused();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(firstTrigger).toBeFocused();

    await firstTrigger.click();
    dialog = page.getByRole('dialog', { name: 'Create budget allocation' });
    await dialog.getByRole('button', { name: 'Create allocation' }).click();
    await expect(dialog.getByLabel('PPMP number')).toBeFocused();
    await expect(dialog.getByText('Enter the PPMP number.')).toBeVisible();

    await dialog.getByLabel('PPMP number').fill('budget ui e2e 001');
    await dialog.getByLabel('Fiscal year').fill('2026');
    await dialog.getByLabel('Quarter').selectOption('3');
    const created = waitForMutation(page, 'POST', '/api/budget-allocations');
    await dialog.getByRole('button', { name: 'Create allocation' }).click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(/\/budget-allocations\/[0-9a-f-]+$/);
    const firstId = page.url().split('/').at(-1)!;

    const ppmpField = page.getByLabel('PPMP number');
    await expect(ppmpField).toHaveValue('BUDGET UI E2E 001');
    await ppmpField.fill('0007 / dispatch e2e');
    const updated = waitForMutation(page, 'PATCH', `/api/budget-allocations/${firstId}`);
    await page.getByRole('button', { name: 'Save draft changes' }).click();
    expect((await updated).ok()).toBe(true);
    await expect(
      page.getByRole('heading', { name: 'Budget allocation 0007 / DISPATCH E2E' }),
    ).toBeVisible();

    await completeAction(page, 'Activate allocation', 'PATCH');
    await expect(page.locator('header').getByText('Active', { exact: true })).toBeVisible();
    expect(
      JSON.stringify(
        await (
          await page.request.get(
            '/api/budget-allocations?mode=operational&effectiveDate=2026-08-28&pageSize=200',
          )
        ).json(),
      ),
    ).toContain(firstId);

    await completeAction(page, 'Close allocation', 'PATCH');
    await expect(page.locator('header').getByText('Closed', { exact: true })).toBeVisible();
    const csrfToken = await readCsrfToken(page);
    const illegalClose = await mutate(
      page,
      csrfToken,
      'PATCH',
      `/api/budget-allocations/${firstId}`,
      { action: 'close' },
    );
    expect(illegalClose.status()).toBe(422);

    await page.goto('/budget-allocations');
    const cancelledId = await createFromDialog(page, 'BUDGET UI E2E CANCEL', 2026, 3);
    await completeAction(page, 'Cancel allocation', 'PATCH', 'Cancelled during browser coverage.');
    await expect(page.locator('header').getByText('Cancelled', { exact: true })).toBeVisible();

    await page.goto('/budget-allocations');
    const restoredId = await createFromDialog(page, 'BUDGET UI E2E RESTORE', 2026, 3);
    await completeAction(page, 'Activate allocation', 'PATCH');
    await expect(page.locator('header').getByText('Active', { exact: true })).toBeVisible();
    await completeAction(page, 'Delete allocation', 'POST', 'Deleted during browser coverage.');
    await expect(page.getByText('Deleted records remain read-only until restored.')).toBeVisible();
    await completeAction(page, 'Restore allocation', 'POST');
    await expect(page.getByLabel('PPMP number')).toBeVisible();
    await expect(page.locator('header').getByText('Draft', { exact: true })).toBeVisible();

    const restoredDetail = await page.request.get(`/api/budget-allocations/${restoredId}`);
    const restoredBody = (await restoredDetail.json()) as ApiEnvelope<AllocationRecord>;
    expect(restoredBody.data.status).toBe('DRAFT');

    await page.goto('/budget-allocations?lifecycle=deleted');
    await expect(page.getByText('E2E-DELETED-ACTIVE').first()).toBeVisible();
    await page.goto(`/budget-allocations/${cancelledId}`);
    await expect(page.getByRole('button', { name: 'Activate allocation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close allocation' })).toHaveCount(0);
  });

  test('duplicate tuples preserve dialog values and focus the conflicting field', async ({
    page,
  }) => {
    await login(page, credentials.budgetOfficer);
    await page.goto('/budget-allocations');
    await page.getByRole('button', { name: 'Create allocation' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create budget allocation' });
    await dialog.getByLabel('PPMP number').fill('E2E-OPERATIONAL-CURRENT');
    await dialog.getByLabel('Fiscal year').fill('2026');
    await dialog.getByLabel('Quarter').selectOption('3');
    await dialog.getByRole('button', { name: 'Create allocation' }).click();

    await expect(
      dialog.getByText('A budget allocation with this identity already exists.'),
    ).toBeVisible();
    await expect(dialog.getByLabel('PPMP number')).toBeFocused();
    await expect(dialog.getByLabel('PPMP number')).toHaveValue('E2E-OPERATIONAL-CURRENT');
    await expect(dialog.getByLabel('Fiscal year')).toHaveValue('2026');
  });

  test('budget lifecycle events become visible through the audit trail', async ({ page }) => {
    await login(page, credentials.auditor);
    for (const action of [
      'created',
      'updated',
      'activated',
      'closed',
      'cancelled',
      'deleted',
      'restored',
    ]) {
      const auditAction = `budget_allocation.${action}`;
      await expect
        .poll(
          async () => {
            await page.goto(`/audit?action=${encodeURIComponent(auditAction)}`);
            return page.locator('table tbody tr').count();
          },
          { message: `${auditAction} should reach the durable audit trail`, timeout: 10_000 },
        )
        .toBeGreaterThan(0);
    }
  });
});

async function createFromDialog(
  page: Page,
  ppmpNumber: string,
  fiscalYear: number,
  quarter: number,
): Promise<string> {
  await page.getByRole('button', { name: 'Create allocation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Create budget allocation' });
  await dialog.getByLabel('PPMP number').fill(ppmpNumber);
  await dialog.getByLabel('Fiscal year').fill(String(fiscalYear));
  await dialog.getByLabel('Quarter').selectOption(String(quarter));
  const response = waitForMutation(page, 'POST', '/api/budget-allocations');
  await dialog.getByRole('button', { name: 'Create allocation' }).click();
  expect((await response).status()).toBe(201);
  await page.waitForURL(/\/budget-allocations\/[0-9a-f-]+$/);
  return page.url().split('/').at(-1)!;
}

async function completeAction(
  page: Page,
  label: string,
  method: 'POST' | 'PATCH',
  reason?: string,
): Promise<void> {
  await page.getByRole('button', { name: label }).click();
  const dialog = page.getByRole('alertdialog', { name: label });
  if (reason !== undefined) await dialog.getByLabel('Reason').fill(reason);
  const response = waitForMutation(page, method, '/api/budget-allocations/');
  await dialog.getByRole('button', { name: label }).click();
  expect((await response).ok()).toBe(true);
}

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  const body = (await response.json()) as ApiEnvelope<{ readonly csrfToken: string }>;
  return body.data.csrfToken;
}

function mutate(
  page: Page,
  csrfToken: string,
  method: 'POST' | 'PATCH',
  path: string,
  data: unknown,
): Promise<APIResponse> {
  return page.request.fetch(path, {
    method,
    data,
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken },
  });
}

function waitForMutation(page: Page, method: string, pathFragment: string) {
  return page.waitForResponse(
    (response) => response.request().method() === method && response.url().includes(pathFragment),
  );
}
