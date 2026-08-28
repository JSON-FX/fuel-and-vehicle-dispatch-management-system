import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

let completedId = '';

test.describe.serial('vehicle dispatch lifecycle', () => {
  test('Dispatch Officer creates, edits, dispatches, and completes with exact distance', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page, credentials.standard);
    await expect(page.getByRole('link', { name: 'Vehicle dispatches' })).toBeVisible();
    await page.goto('/dispatches/new');
    await expect(page.getByRole('heading', { name: 'New dispatch' })).toBeVisible();
    await expect(page.getByLabel('Driver')).not.toContainText('Casey Santos');
    await expect(page.getByLabel('Vehicle')).not.toContainText('FVD 102');
    await expect(page.getByLabel('Driver')).not.toContainText('Archived Driver');

    await page.getByLabel('Entry date').fill('2026-08-29');
    await page.getByLabel('Travel date').fill('2026-08-30');
    await page.getByLabel('Destination').fill('District Hospital');
    await page.getByLabel('Purpose').fill('Transfer medical supplies');
    await page.getByLabel('Initial odometer (km)').fill('90071992547.1');
    await page.getByLabel('Passenger count').fill('3');
    const created = waitForMutation(page, 'POST', '/api/dispatches');
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(/\/dispatches\/[0-9a-f-]+$/);
    completedId = page.url().split('/').at(-1)!;

    await page.getByRole('link', { name: 'Edit draft' }).click();
    await page.getByLabel('Purpose').fill('Updated medical supply transfer');
    const updated = waitForMutation(page, 'PATCH', `/api/dispatches/${completedId}`);
    await page.getByRole('button', { name: 'Save draft changes' }).click();
    expect((await updated).ok()).toBe(true);

    await page.getByRole('button', { name: 'Dispatch vehicle' }).click();
    let dialog = page.getByRole('alertdialog', { name: 'Dispatch this vehicle?' });
    const dispatched = waitForMutation(page, 'POST', `/${completedId}/dispatch`);
    await dialog.getByRole('button', { name: 'Confirm dispatch' }).click();
    expect((await dispatched).ok()).toBe(true);
    await expect(page.getByText('Dispatched', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Complete dispatch' }).click();
    dialog = page.getByRole('alertdialog', { name: 'Complete this dispatch?' });
    await dialog.getByLabel('Final odometer (km)').fill('90071992547.2');
    await expect(dialog.getByText('Distance: 0.1 km')).toBeVisible();
    const completed = waitForMutation(page, 'POST', `/${completedId}/complete`);
    await dialog.getByRole('button', { name: 'Complete dispatch' }).click();
    expect((await completed).ok()).toBe(true);
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText('0.1 km')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete dispatch' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel dispatch' })).toHaveCount(0);
  });

  test('Dispatch Officer cancels an active dispatch with permanent reason evidence', async ({
    page,
  }) => {
    await login(page, credentials.standard);
    await page.goto('/dispatches/new');
    await page.getByLabel('Entry date').fill('2026-08-29');
    await page.getByLabel('Travel date').fill('2026-08-31');
    await page.getByLabel('Destination').fill('Provincial Capitol');
    await page.getByLabel('Purpose').fill('Administrative coordination');
    await page.getByLabel('Initial odometer (km)').fill('1260.5');
    await page.getByLabel('Passenger count').fill('1');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await page.waitForURL(/\/dispatches\/[0-9a-f-]+$/);
    const cancelledId = page.url().split('/').at(-1)!;

    await page.getByRole('button', { name: 'Dispatch vehicle' }).click();
    await page
      .getByRole('alertdialog', { name: 'Dispatch this vehicle?' })
      .getByRole('button', { name: 'Confirm dispatch' })
      .click();
    await expect(page.getByText('Dispatched', { exact: true })).toBeVisible();

    const cancelTrigger = page.getByRole('button', { name: 'Cancel dispatch' });
    await cancelTrigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Cancel this dispatch?' });
    await expect(dialog.getByLabel('Reason')).toBeFocused();
    await dialog.getByLabel('Reason').fill('Vehicle reassigned for emergency response.');
    const cancelled = waitForMutation(page, 'POST', `/${cancelledId}/cancel`);
    await dialog.getByRole('button', { name: 'Cancel dispatch' }).click();
    expect((await cancelled).ok()).toBe(true);
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
    await expect(page.getByText('Vehicle reassigned for emergency response.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel dispatch' })).toHaveCount(0);
  });

  test('terminal dispatches reject direct edit, completion, and cancellation attempts', async ({
    page,
  }) => {
    expect(completedId).not.toBe('');
    await login(page, credentials.standard);
    const csrfToken = await readCsrfToken(page);
    const headers = { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken };
    const detail = await readDispatch(page, completedId);
    expect(
      (
        await page.request.patch(`/api/dispatches/${completedId}`, {
          data: dispatchCommand(detail),
          headers,
        })
      ).status(),
    ).toBe(422);
    expect(
      (
        await page.request.post(`/api/dispatches/${completedId}/complete`, {
          data: { odoAfter: '90071992547.3' },
          headers,
        })
      ).status(),
    ).toBe(422);
    expect(
      (
        await page.request.post(`/api/dispatches/${completedId}/cancel`, {
          data: { reason: 'A terminal dispatch cannot be cancelled again.' },
          headers,
        })
      ).status(),
    ).toBe(422);
  });
});

interface DispatchEnvelope {
  readonly data: {
    readonly entryDate: string;
    readonly travelDate: string;
    readonly driver: { readonly publicId: string };
    readonly vehicle: { readonly publicId: string };
    readonly requestingOffice: { readonly publicId: string };
    readonly destination: string;
    readonly purpose: string;
    readonly odoBefore: string;
    readonly passengerCount: number;
  };
}

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}

async function readDispatch(page: Page, publicId: string): Promise<DispatchEnvelope['data']> {
  const response = await page.request.get(`/api/dispatches/${publicId}`);
  return ((await response.json()) as DispatchEnvelope).data;
}

function dispatchCommand(detail: DispatchEnvelope['data']) {
  return {
    entryDate: detail.entryDate,
    travelDate: detail.travelDate,
    driverPublicId: detail.driver.publicId,
    vehiclePublicId: detail.vehicle.publicId,
    requestingOfficePublicId: detail.requestingOffice.publicId,
    destination: detail.destination,
    purpose: detail.purpose,
    odoBefore: detail.odoBefore,
    passengerCount: detail.passengerCount,
  };
}

function waitForMutation(page: Page, method: string, pathFragment: string) {
  return page.waitForResponse(
    (response) => response.request().method() === method && response.url().includes(pathFragment),
  );
}
