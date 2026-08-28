import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';
import { masterDataFixtureIds } from './fixtures/master-data';

const historicalDispatchId = '019e0000-0000-7007-8000-000000000001';

test('read-only users can list and inspect dispatches without mutation affordances', async ({
  page,
}) => {
  await login(page, credentials.viewer);
  await expect(page.getByRole('link', { name: 'Vehicle dispatches' })).toBeVisible();
  await page.goto('/dispatches');
  await expect(
    page.getByRole('heading', { name: 'Vehicle dispatches', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'New dispatch' })).toHaveCount(0);
  expect((await page.request.get('/api/dispatches')).status()).toBe(200);

  await page.goto(`/dispatches/${historicalDispatchId}`);
  await expect(page.getByRole('heading', { name: 'Archived District Warehouse' })).toBeVisible();
  await expect(page.getByText('Archived Driver')).toBeVisible();
  await expect(page.getByText('FVD 103', { exact: true })).toBeVisible();
  await expect(page.getByText(/Archived Office/).first()).toBeVisible();
  await expect(page.locator('span').filter({ hasText: /^Completed$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /dispatch|complete|cancel/i })).toHaveCount(0);

  const denied = await page.request.post(`/api/dispatches/${historicalDispatchId}/cancel`, {
    data: { reason: 'Viewer cannot cancel a historical dispatch.' },
    headers: { origin: 'http://localhost:3100', 'x-csrf-token': 'not-authorized' },
  });
  expect(denied.status()).toBe(403);
});

test('Dispatch Officer sees only eligible options and direct ineligible assignments fail', async ({
  page,
}) => {
  await login(page, credentials.standard);
  const csrfToken = await readCsrfToken(page);
  const options = await page.request.get('/api/dispatch-preparation-options');
  const preparation = (await options.json()) as PreparationEnvelope;
  expect(JSON.stringify(preparation)).not.toContain(masterDataFixtureIds.inactiveDriver);
  expect(JSON.stringify(preparation)).not.toContain(masterDataFixtureIds.unserviceableVehicle);

  const command = {
    entryDate: '2026-08-29',
    travelDate: '2026-09-01',
    driverPublicId: masterDataFixtureIds.inactiveDriver,
    vehiclePublicId: preparation.data.vehicles[0]!.publicId,
    requestingOfficePublicId: preparation.data.offices[0]!.publicId,
    destination: 'Eligibility rejection proof',
    purpose: 'Direct API request must recheck references',
    odoBefore: '1000.0',
    passengerCount: 1,
  };
  const headers = { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken };
  expect((await page.request.post('/api/dispatches', { data: command, headers })).status()).toBe(
    422,
  );
  expect(
    (
      await page.request.post('/api/dispatches', {
        data: {
          ...command,
          driverPublicId: preparation.data.drivers[0]!.publicId,
          vehiclePublicId: masterDataFixtureIds.unserviceableVehicle,
        },
        headers,
      })
    ).status(),
  ).toBe(422);
});

test('PSMD-only and unauthenticated users cannot read dispatch records', async ({
  page,
  browser,
}) => {
  await login(page, credentials.psmd);
  await expect(page.getByRole('link', { name: 'Vehicle dispatches' })).toHaveCount(0);
  await page.goto('/dispatches');
  await expect(page.getByRole('heading', { name: 'Vehicle dispatch access denied' })).toBeVisible();
  expect((await page.request.get('/api/dispatches')).status()).toBe(403);
  const context = await browser.newContext({ baseURL: 'http://localhost:3100' });
  expect((await context.request.get(`/api/dispatches/${historicalDispatchId}`)).status()).toBe(401);
  await context.close();
});

test('edited public IDs, CSRF failures, and inaccessible objects return safe responses', async ({
  page,
}) => {
  await login(page, credentials.standard);
  const edited = `${historicalDispatchId.slice(0, -1)}2`;
  const missing = await page.request.get(`/api/dispatches/${edited}`);
  expect(missing.status()).toBe(404);
  expect(JSON.stringify(await missing.json())).not.toMatch(/sql|constraint|vehicle_dispatches/i);
  const csrfFailure = await page.request.post(`/api/dispatches/${historicalDispatchId}/dispatch`, {
    data: {},
    headers: { origin: 'https://attacker.example', 'x-csrf-token': 'invalid' },
  });
  expect(csrfFailure.status()).toBe(403);
});

interface PreparationEnvelope {
  readonly data: {
    readonly offices: readonly { readonly publicId: string }[];
    readonly drivers: readonly { readonly publicId: string }[];
    readonly vehicles: readonly { readonly publicId: string }[];
  };
}

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}
