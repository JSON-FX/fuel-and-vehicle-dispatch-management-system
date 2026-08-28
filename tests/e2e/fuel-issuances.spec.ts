import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

let postedId = '';

test.describe.serial('fuel issuance lifecycle', () => {
  test('PSMD staff creates, edits, and atomically posts a standard draft', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, credentials.psmd);
    await page.goto('/fuel-issuances');
    await expect(page.getByRole('heading', { name: 'Fuel issuances', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'New fuel issuance' }).click();
    await expect(page.getByRole('heading', { name: 'New fuel issuance' })).toBeVisible();

    await page.getByLabel('Purchase request number').fill('FUEL UI E2E 001');
    await page.getByLabel('Purpose').fill('Provincial field operations');
    await page.getByLabel('Requested liters').fill('30.125');
    await page.getByLabel('Unit price per liter').fill('61.25');
    await expect(page.getByText('Vehicle type', { exact: true })).toBeVisible();
    const emptyOptions = waitForMutation(
      page,
      'GET',
      '/api/fuel-preparation-options?entryDate=2026-06-30',
    );
    await page.getByLabel('Entry date').fill('2026-06-30');
    expect((await emptyOptions).ok()).toBe(true);
    await expect(page.getByText('No active allocation matches this entry date.')).toBeVisible();
    const currentOptions = waitForMutation(
      page,
      'GET',
      '/api/fuel-preparation-options?entryDate=2026-08-28',
    );
    await page.getByLabel('Entry date').fill('2026-08-28');
    expect((await currentOptions).ok()).toBe(true);
    await expect(page.getByLabel('PPMP allocation')).not.toHaveValue('');
    const created = waitForMutation(page, 'POST', '/api/fuel-issuances');
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(/\/fuel-issuances\/[0-9a-f-]+$/);
    postedId = page.url().split('/').at(-1)!;

    await expect(page.getByRole('heading', { name: 'Pending RIS' })).toBeVisible();
    await page.getByRole('link', { name: 'Edit draft' }).click();
    await page.getByLabel('Purpose').fill('Updated provincial field operations');
    const updated = waitForMutation(page, 'PATCH', `/api/fuel-issuances/${postedId}`);
    await page.getByRole('button', { name: 'Save draft changes' }).click();
    expect((await updated).ok()).toBe(true);

    await page.getByRole('button', { name: 'Post issuance' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Post fuel issuance?' });
    await expect(dialog.getByLabel('Actual issued liters')).toHaveValue('30.125');
    const posted = waitForMutation(page, 'POST', `/api/fuel-issuances/${postedId}/post`);
    await dialog.getByRole('button', { name: 'Post and assign RIS' }).click();
    expect((await posted).ok()).toBe(true);
    await expect(page.getByRole('heading', { name: /^\d{4}-\d{2}-\d{3,}$/ })).toBeVisible();
    await expect(page.getByText('-30.125 L')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Void issuance' })).toHaveCount(0);
  });

  test('SUPER_ADMIN voids the posting with a reason and preserves both ledger rows', async ({
    page,
  }) => {
    expect(postedId).not.toBe('');
    await login(page, {
      username: credentials.administrator.username,
      password: credentials.administrator.password,
    });
    await page.goto(`/fuel-issuances/${postedId}`);
    await page.getByRole('button', { name: 'Void issuance' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Void posted fuel issuance?' });
    await dialog
      .getByLabel('Reason')
      .fill('Duplicate dispatch record entered during browser verification.');
    const voided = waitForMutation(page, 'POST', `/api/fuel-issuances/${postedId}/void`);
    await dialog.getByRole('button', { name: 'Void and compensate' }).click();
    expect((await voided).ok()).toBe(true);
    await expect(page.getByText('Voided', { exact: true })).toBeVisible();
    await expect(page.getByText('-30.125 L')).toBeVisible();
    await expect(page.getByText('30.125 L').last()).toBeVisible();
    await expect(
      page.getByText('Duplicate dispatch record entered during browser verification.'),
    ).toBeVisible();
  });

  test('balance summary reconciles the issuance and void adjustment', async ({ page }) => {
    await login(page, credentials.psmd);
    await page.goto(
      '/fuel-issuances/balances?startDate=2026-08-01&endDate=2026-08-31&fuelType=DIESEL',
    );
    await expect(page.getByRole('heading', { name: 'Fuel balances' })).toBeVisible();
    await expect(page.getByText('−30.125 L')).toBeVisible();
    await expect(page.getByText('+30.125 L')).toBeVisible();
    await expect(page.getByText('Closing').locator('..').getByText('0.000 L')).toBeVisible();
  });

  test('full-tank drafts omit requested liters and require actual liters before posting', async ({
    page,
  }) => {
    await login(page, credentials.psmd);
    await page.goto('/fuel-issuances/new');
    await page.getByLabel('Purchase request number').fill('FUEL UI E2E FULL TANK');
    await page.getByLabel('Purpose').fill('Full-tank emergency response');
    await page.getByLabel('Full tank').check();
    await expect(page.getByLabel('Requested liters')).toHaveCount(0);
    await page.getByLabel('Unit price per liter').fill('61.25');

    const created = waitForMutation(page, 'POST', '/api/fuel-issuances');
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await created).status()).toBe(201);
    await page.waitForURL(/\/fuel-issuances\/[0-9a-f-]+$/);
    await expect(page.getByText('Full tank', { exact: true })).toBeVisible();
    await expect(page.getByText('Not applicable')).toBeVisible();

    const postTrigger = page.getByRole('button', { name: 'Post issuance' });
    await postTrigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Post fuel issuance?' });
    await expect(dialog.getByLabel('Actual issued liters')).toBeFocused();
    await expect(dialog.getByLabel('Actual issued liters')).toHaveValue('');

    const rejected = waitForMutation(page, 'POST', '/post');
    await dialog.getByRole('button', { name: 'Post and assign RIS' }).click();
    expect((await rejected).status()).toBe(400);
    await expect(
      dialog.getByText('Provide a positive decimal with up to three places.'),
    ).toBeVisible();
    await expect(dialog.locator('#post-error-summary')).toBeFocused();

    await dialog.getByLabel('Actual issued liters').fill('42.5');
    const posted = waitForMutation(page, 'POST', '/post');
    await dialog.getByRole('button', { name: 'Post and assign RIS' }).click();
    expect((await posted).ok()).toBe(true);
    await expect(page.getByRole('heading', { name: /^\d{4}-\d{2}-\d{3,}$/ })).toBeVisible();
    await expect(page.getByText('-42.5 L')).toBeVisible();
  });
});

function waitForMutation(page: Page, method: string, pathFragment: string) {
  return page.waitForResponse(
    (response) => response.request().method() === method && response.url().includes(pathFragment),
  );
}
