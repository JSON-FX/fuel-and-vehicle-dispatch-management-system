import { expect, test, type Page } from '@playwright/test';

import { credentials, login } from './fixtures/auth';

test.describe.serial('dispatch conflicts and availability', () => {
  test('advises, rejects stale bypasses, accepts reviewed evidence, and shows history', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page, credentials.standard);
    const csrfToken = await readCsrfToken(page);
    const options = await preparation(page);
    const command = {
      entryDate: '2027-01-14',
      travelDate: '2027-01-15',
      driverPublicId: options.drivers[0]!.publicId,
      vehiclePublicId: options.vehicles[0]!.publicId,
      requestingOfficePublicId: options.offices[0]!.publicId,
      destination: 'Conflict baseline destination',
      purpose: 'Reserve both resources for deterministic conflict coverage',
      odoBefore: '3000.0',
      passengerCount: 2,
    };
    const headers = { origin: 'http://localhost:3100', 'x-csrf-token': csrfToken };
    const baseline = await page.request.post('/api/dispatches', { data: command, headers });
    expect(baseline.status()).toBe(201);
    const baselineId = ((await baseline.json()) as { data: { publicId: string } }).data.publicId;

    const advisory = await page.request.get(
      `/api/dispatches/conflicts?travelDate=${command.travelDate}&driverPublicId=${command.driverPublicId}&vehiclePublicId=${command.vehiclePublicId}`,
    );
    expect(advisory.status()).toBe(200);
    const conflict = (await advisory.json()) as ConflictEnvelope;
    expect(conflict.data).toMatchObject({ policy: 'WARN_AND_ACK', canOverride: true });
    expect(conflict.data.conflicts).toEqual([
      expect.objectContaining({
        dispatchPublicId: baselineId,
        conflictType: 'DRIVER_AND_VEHICLE',
      }),
    ]);

    const unacknowledged = await page.request.post('/api/dispatches', {
      data: { ...command, destination: 'Unacknowledged second destination' },
      headers,
    });
    expect(unacknowledged.status()).toBe(409);
    const warning = (await unacknowledged.json()) as ConflictErrorEnvelope;
    expect(warning.error.code).toBe('DISPATCH_SCHEDULE_CONFLICT');

    const editedEvidence = await page.request.post('/api/dispatches', {
      data: {
        ...command,
        destination: 'Edited evidence rejection',
        conflictOverride: {
          acknowledged: true,
          reason: 'Reviewed the schedule but edited protected conflict fields.',
          fingerprint: warning.error.context.fingerprint,
          conflictType: 'VEHICLE',
        },
      },
      headers,
    });
    expect(editedEvidence.status()).toBe(400);

    const accepted = await page.request.post('/api/dispatches', {
      data: {
        ...command,
        destination: 'Reviewed second destination',
        conflictOverride: {
          acknowledged: true,
          reason: 'Reviewed the shared schedule and approved this second official trip.',
          fingerprint: warning.error.context.fingerprint,
        },
      },
      headers,
    });
    expect(accepted.status()).toBe(201);
    const acceptedId = ((await accepted.json()) as { data: { publicId: string } }).data.publicId;

    await page.goto(`/dispatches/${acceptedId}`);
    await expect(
      page.getByRole('heading', { name: 'Schedule conflict acknowledgments' }),
    ).toBeVisible();
    await expect(
      page.getByText('Reviewed the shared schedule and approved this second official trip.'),
    ).toBeVisible();

    await page.goto(
      `/dispatches/schedule?view=week&date=2027-01-15&driverPublicId=${command.driverPublicId}`,
    );
    await expect(page.getByRole('heading', { name: 'Dispatch schedule' })).toBeVisible();
    await expect(page.getByText('Conflict baseline destination').first()).toBeVisible();
    await expect(page.getByText('Reviewed second destination').first()).toBeVisible();
    await expect(page.getByText('Conflict', { exact: true }).first()).toBeVisible();
  });

  test('draft form announces advisory conflicts without disabling authoritative save', async ({
    page,
  }) => {
    await login(page, credentials.standard);
    await page.goto('/dispatches/new');
    await page.getByLabel('Travel date').fill('2027-01-15');
    await expect(page.getByRole('status')).toContainText('schedule conflict');
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  });
});

interface ConflictEnvelope {
  readonly data: {
    readonly policy: string;
    readonly canOverride: boolean;
    readonly conflicts: readonly {
      readonly dispatchPublicId: string;
      readonly conflictType: string;
    }[];
  };
}

interface ConflictErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly context: { readonly fingerprint: string };
  };
}

async function readCsrfToken(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  return ((await response.json()) as { data: { csrfToken: string } }).data.csrfToken;
}

async function preparation(page: Page) {
  const response = await page.request.get('/api/dispatch-preparation-options');
  return (
    (await response.json()) as {
      data: {
        offices: readonly { publicId: string }[];
        drivers: readonly { publicId: string }[];
        vehicles: readonly { publicId: string }[];
      };
    }
  ).data;
}
