import {
  expect,
  test,
  type APIResponse,
  type Page,
  type Response as BrowserResponse,
} from '@playwright/test';

import { credentials, login } from './fixtures/auth';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
  readonly error?: {
    readonly details: readonly { readonly field?: string; readonly reason: string }[];
  };
}

interface CreatedRecord {
  readonly publicId: string;
}

test.describe.serial('master-data management', () => {
  test('manager navigation and create dialog support keyboard focus and field conflicts', async ({
    page,
  }) => {
    await login(page, credentials.manager);
    await page.getByText('Master data', { exact: true }).click();
    await expect(page.getByRole('link', { name: 'Offices' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Drivers' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Vehicles' })).toBeVisible();

    await page.goto('/admin/offices');
    const trigger = page.getByRole('button', { name: 'Create office' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Create office' });
    await expect(dialog.getByLabel('Office name')).toBeFocused();
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole('button', { name: 'Create office' }).click();
    await expect(dialog.getByLabel('Office name')).toBeFocused();
    await expect(dialog.getByText('Enter the office name.')).toBeVisible();

    await dialog.getByLabel('Office name').fill('Operations Office');
    await dialog.getByLabel('Office abbreviation').fill('OPS-DUPLICATE');
    await dialog.getByRole('button', { name: 'Create office' }).click();
    await expect(dialog.getByText('A unique master-data value already exists.')).toBeVisible();
    await expect(dialog.getByLabel('Office name')).toBeFocused();
    await expect(dialog.getByLabel('Office abbreviation')).toHaveValue('OPS-DUPLICATE');
  });

  test('manager completes each lifecycle through the administration interface', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await login(page, credentials.manager);

    await page.goto('/admin/offices?lifecycle=deleted');
    await expect(page.getByRole('row').filter({ hasText: 'Archived Office' })).toBeVisible();
    await page.goto('/admin/offices');
    await page.getByRole('button', { name: 'Create office' }).click();
    let dialog = page.getByRole('dialog', { name: 'Create office' });
    await dialog.getByLabel('Office name').fill('Interface Office E2E');
    await dialog.getByLabel('Office abbreviation').fill('IO-E2E');
    await dialog.getByRole('button', { name: 'Create office' }).click();
    await page.waitForURL(/\/admin\/offices\/[0-9a-f-]+$/);
    await page.getByLabel('Office name').fill('Interface Office Updated E2E');
    await page.getByLabel('Operational status').selectOption('INACTIVE');
    page.once('dialog', (confirmation) => confirmation.accept());
    const officeUpdate = waitForMutation(page, 'PATCH', '/api/offices/');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await officeUpdate).ok()).toBe(true);
    await expect(page.locator('header').getByText('Inactive', { exact: true })).toBeVisible();
    await deleteAndRestore(page, 'office');
    await expect(page.getByLabel('Operational status')).toHaveValue('INACTIVE');

    await page.goto('/admin/drivers');
    await page.getByRole('button', { name: 'Create driver' }).click();
    dialog = page.getByRole('dialog', { name: 'Create driver' });
    await dialog.getByLabel('Driver name').fill('Interface Driver E2E');
    await dialog.getByLabel('Contact number (optional)').fill('+63 917 555 0300');
    await dialog.getByRole('button', { name: 'Create driver' }).click();
    await page.waitForURL(/\/admin\/drivers\/[0-9a-f-]+$/);
    await page.getByLabel('Driver name').fill('Interface Driver Updated E2E');
    await page.getByLabel('Operational status').selectOption('INACTIVE');
    page.once('dialog', (confirmation) => confirmation.accept());
    const driverUpdate = waitForMutation(page, 'PATCH', '/api/drivers/');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await driverUpdate).ok()).toBe(true);
    await expect(page.locator('header').getByText('Inactive', { exact: true })).toBeVisible();
    await deleteAndRestore(page, 'driver');
    await expect(page.getByLabel('Operational status')).toHaveValue('INACTIVE');

    await page.goto('/admin/vehicles');
    await page.getByRole('button', { name: 'Create vehicle' }).click();
    dialog = page.getByRole('dialog', { name: 'Create vehicle' });
    await dialog.getByLabel('Model or brand').fill('Interface Vehicle E2E');
    await dialog.getByLabel('Vehicle type').fill('Utility truck');
    await dialog.getByLabel('Plate number').fill('UI E2E 601');
    await dialog.getByLabel('Remarks (optional)').fill('Interface lifecycle coverage');
    await dialog.getByRole('button', { name: 'Create vehicle' }).click();
    await page.waitForURL(/\/admin\/vehicles\/[0-9a-f-]+$/);
    await page.getByLabel('Model or brand').fill('Interface Vehicle Updated E2E');
    await page.getByLabel('Serviceability').selectOption('UNSERVICEABLE');
    page.once('dialog', (confirmation) => confirmation.accept());
    const vehicleUpdate = waitForMutation(page, 'PATCH', '/api/vehicles/');
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await vehicleUpdate).ok()).toBe(true);
    await expect(page.locator('header').getByText('Unserviceable', { exact: true })).toBeVisible();
    await deleteAndRestore(page, 'vehicle');
    await expect(page.getByLabel('Serviceability')).toHaveValue('UNSERVICEABLE');
  });

  test('manager completes create, edit, status, delete, filter, and safe-restore lifecycles', async ({
    page,
  }) => {
    await login(page, credentials.manager);
    const csrfToken = await readCsrfToken(page);

    const office = await createRecord(page, csrfToken, 'offices', {
      name: 'Field Office E2E',
      abbreviation: 'FOE2E',
    });
    await expectDuplicate(
      await mutate(page, csrfToken, 'POST', '/api/offices', {
        name: 'Field Office E2E',
        abbreviation: 'FOE2E-DUP',
      }),
      'name',
    );
    const officeUpdate = await mutate(page, csrfToken, 'PATCH', `/api/offices/${office.publicId}`, {
      name: 'Field Operations Office E2E',
      abbreviation: 'FOPS-E2E',
      status: 'INACTIVE',
    });
    expect(officeUpdate.ok()).toBe(true);
    await completeLifecycle(page, csrfToken, 'offices', office.publicId, 'INACTIVE');

    const driver = await createRecord(page, csrfToken, 'drivers', {
      name: 'Morgan E2E Driver',
      contactNumber: '+63 917 555 0199',
    });
    expect(
      (
        await mutate(page, csrfToken, 'PATCH', `/api/drivers/${driver.publicId}`, {
          name: 'Morgan Updated E2E Driver',
          contactNumber: '+63 917 555 0200',
          status: 'INACTIVE',
        })
      ).ok(),
    ).toBe(true);
    await completeLifecycle(page, csrfToken, 'drivers', driver.publicId, 'INACTIVE');

    const vehicle = await createRecord(page, csrfToken, 'vehicles', {
      modelBrand: 'Nissan Navara E2E',
      vehicleType: 'Pickup',
      plateNumber: 'E2E 501',
      remarks: 'Created through lifecycle coverage',
    });
    expect(
      (
        await mutate(page, csrfToken, 'PATCH', `/api/vehicles/${vehicle.publicId}`, {
          modelBrand: 'Nissan Navara Updated E2E',
          vehicleType: 'Utility pickup',
          plateNumber: 'E2E 501',
          remarks: 'Updated without losing entered remarks',
          status: 'UNSERVICEABLE',
        })
      ).ok(),
    ).toBe(true);
    await completeLifecycle(page, csrfToken, 'vehicles', vehicle.publicId, 'UNSERVICEABLE');
  });

  test('master-data lifecycle events become visible through the auditor interface', async ({
    page,
  }) => {
    await login(page, credentials.auditor);
    for (const resource of ['office', 'driver', 'vehicle']) {
      for (const action of ['created', 'updated', 'status_changed', 'deleted', 'restored']) {
        const auditAction = `${resource}.${action}`;
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
    }
  });
});

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as ApiEnvelope<{ readonly csrfToken: string }>;
  return body.data.csrfToken;
}

async function createRecord(
  page: Page,
  csrfToken: string,
  resource: 'offices' | 'drivers' | 'vehicles',
  data: Readonly<Record<string, string>>,
): Promise<CreatedRecord> {
  const response = await mutate(page, csrfToken, 'POST', `/api/${resource}`, data);
  expect(response.status()).toBe(201);
  const body = (await response.json()) as ApiEnvelope<CreatedRecord>;
  return body.data;
}

async function completeLifecycle(
  page: Page,
  csrfToken: string,
  resource: 'offices' | 'drivers' | 'vehicles',
  publicId: string,
  restoredStatus: string,
): Promise<void> {
  const deletion = await mutate(
    page,
    csrfToken,
    'POST',
    `/api/${resource}/${publicId}/soft-delete`,
    { reason: `Browser lifecycle deletion for ${resource}` },
  );
  expect(deletion.ok()).toBe(true);

  const deletedList = await page.request.get(`/api/${resource}?mode=admin&lifecycle=deleted`);
  expect(deletedList.ok()).toBe(true);
  expect(JSON.stringify(await deletedList.json())).toContain(publicId);

  const restore = await mutate(page, csrfToken, 'POST', `/api/${resource}/${publicId}/restore`, {});
  expect(restore.ok()).toBe(true);

  const detail = await page.request.get(`/api/${resource}/${publicId}`);
  const detailBody = (await detail.json()) as ApiEnvelope<{ readonly status: string }>;
  expect(detailBody.data.status).toBe(restoredStatus);

  const selector = await page.request.get(`/api/${resource}?mode=operational&pageSize=200`);
  expect(selector.ok()).toBe(true);
  expect(JSON.stringify(await selector.json())).not.toContain(publicId);
}

async function mutate(
  page: Page,
  csrfToken: string,
  method: 'POST' | 'PATCH',
  path: string,
  data: unknown,
): Promise<APIResponse> {
  return page.request.fetch(path, {
    method,
    data,
    headers: {
      origin: 'http://localhost:3100',
      'x-csrf-token': csrfToken,
    },
  });
}

async function expectDuplicate(response: APIResponse, field: string): Promise<void> {
  expect(response.status()).toBe(409);
  const body = (await response.json()) as ApiEnvelope<never>;
  expect(body.error?.details).toContainEqual({ field, reason: 'This value is already in use.' });
}

function waitForMutation(
  page: Page,
  method: string,
  pathFragment: string,
): Promise<BrowserResponse> {
  return page.waitForResponse(
    (response) => response.request().method() === method && response.url().includes(pathFragment),
  );
}

async function deleteAndRestore(
  page: Page,
  resource: 'office' | 'driver' | 'vehicle',
): Promise<void> {
  const title = `${resource[0]!.toUpperCase()}${resource.slice(1)}`;
  await page.getByRole('button', { name: `Delete ${resource}` }).click();
  let dialog = page.getByRole('alertdialog', { name: `Delete ${resource}` });
  await dialog.getByLabel('Reason').fill(`${title} removed during interface lifecycle coverage.`);
  const deletion = waitForMutation(page, 'POST', '/soft-delete');
  await dialog.getByRole('button', { name: `Delete ${resource}` }).click();
  expect((await deletion).ok()).toBe(true);
  await expect(page.getByText('Deleted records remain read-only until restored.')).toBeVisible();

  await page.getByRole('button', { name: `Restore ${resource}` }).click();
  dialog = page.getByRole('alertdialog', { name: `Restore ${resource}` });
  const restoration = waitForMutation(page, 'POST', '/restore');
  await dialog.getByRole('button', { name: `Restore ${resource}` }).click();
  expect((await restoration).ok()).toBe(true);
  await expect(
    page.getByLabel(
      resource === 'vehicle'
        ? 'Serviceability'
        : resource === 'office'
          ? 'Office name'
          : 'Driver name',
    ),
  ).toBeVisible();
}
