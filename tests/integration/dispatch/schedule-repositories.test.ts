import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { DispatchScheduleQuery } from '@/application/dispatch/dto/dispatch-dtos';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { KyselyDispatchConflictOverrideRepository } from '@/infrastructure/database/dispatch/kysely-dispatch-conflict-override-repository';
import { KyselyDispatchRepository } from '@/infrastructure/database/dispatch/kysely-dispatch-repository';
import { KyselyDispatchScheduleRepository } from '@/infrastructure/database/dispatch/kysely-dispatch-schedule-repository';
import { KyselyDispatchScheduleSettingsRepository } from '@/infrastructure/database/dispatch/kysely-dispatch-schedule-settings-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  dispatchActorPublicId,
  dispatchPublicId,
  dispatchTestAt,
  prepareDispatchDatabase,
  resetDispatchDatabase,
  seedDispatchReferences,
  type DispatchReferenceFixture,
} from '../helpers/dispatch-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let primary: DispatchReferenceFixture;
let alternate: DispatchReferenceFixture;

function draft(
  suffix: number,
  resources: Pick<DispatchReferenceFixture, 'office' | 'driver' | 'vehicle'>,
): VehicleDispatch {
  return new VehicleDispatch({
    publicId: dispatchPublicId(800 + suffix),
    entryDate: DispatchDate.from('2026-08-29'),
    travelDate: DispatchDate.from('2026-08-30'),
    driverPublicId: resources.driver.publicId,
    vehiclePublicId: resources.vehicle.publicId,
    requestingOfficePublicId: resources.office.publicId,
    destination: `Schedule destination ${suffix}`,
    purpose: `Schedule repository proof ${suffix}`,
    odoBefore: OdometerReading.from(`${2000 + suffix}.0`),
    passengerCount: PassengerCount.from(2),
    createdByActorPublicId: dispatchActorPublicId,
    createdAt: dispatchTestAt,
    updatedAt: dispatchTestAt,
  });
}

const scheduleQuery = (overrides: Partial<DispatchScheduleQuery> = {}): DispatchScheduleQuery => ({
  from: '2026-08-30',
  to: '2026-08-30',
  requestingOfficePublicId: null,
  driverPublicId: null,
  vehiclePublicId: null,
  status: null,
  limit: 200,
  ...overrides,
});

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareDispatchDatabase(database);
});

beforeEach(async () => {
  await resetDispatchDatabase(database);
  primary = await seedDispatchReferences(database, 0);
  alternate = await seedDispatchReferences(database, 1);
});

afterAll(async () => {
  await database.destroy();
});

describe('dispatch scheduling repositories', () => {
  it('merges matching resources, includes completed trips, excludes cancelled trips and self', async () => {
    const dispatches = new KyselyDispatchRepository(database);
    const schedules = new KyselyDispatchScheduleRepository(database);
    const both = draft(1, primary);
    const driverOnly = draft(2, { ...primary, vehicle: alternate.vehicle });
    const vehicleOnlyCancelled = draft(3, { ...primary, driver: alternate.driver });
    await dispatches.insert(both);
    await dispatches.insert(driverOnly);
    await dispatches.insert(vehicleOnlyCancelled);
    driverOnly.markDispatched(dispatchTestAt);
    driverOnly.complete(OdometerReading.from('2100.0'), dispatchTestAt);
    await dispatches.updateLifecycle(driverOnly);
    vehicleOnlyCancelled.cancel({
      at: dispatchTestAt,
      actorPublicId: dispatchActorPublicId,
      reason: 'Cancelled before the scheduling repository check.',
    });
    await dispatches.updateLifecycle(vehicleOnlyCancelled);

    const candidate = {
      travelDate: '2026-08-30',
      driverPublicId: primary.driver.publicId.toString(),
      vehiclePublicId: primary.vehicle.publicId.toString(),
      excludedDispatchPublicId: null,
    };
    const conflicts = await schedules.findAdvisoryConflicts(candidate);

    expect(conflicts.map((conflict) => [conflict.dispatchPublicId, conflict.conflictType])).toEqual(
      [
        [both.publicId.toString(), 'DRIVER_AND_VEHICLE'],
        [driverOnly.publicId.toString(), 'DRIVER'],
      ],
    );
    await expect(
      schedules.findCurrentConflictsForShare({
        ...candidate,
        excludedDispatchPublicId: both.publicId.toString(),
      }),
    ).resolves.toMatchObject([{ dispatchPublicId: driverOnly.publicId.toString() }]);
    expect(conflicts[0]?.driver).not.toHaveProperty('contactNumber');
  });

  it('returns bounded schedule events while computing selected-resource occupancy independently', async () => {
    const dispatches = new KyselyDispatchRepository(database);
    const schedules = new KyselyDispatchScheduleRepository(database);
    await dispatches.insert(draft(4, primary));
    await dispatches.insert(draft(5, { ...primary, vehicle: alternate.vehicle }));

    const query = scheduleQuery({
      driverPublicId: primary.driver.publicId.toString(),
      limit: 1,
    });
    const page = await schedules.listSchedule(query);
    const occupancy = await schedules.getOccupancy(query);

    expect(page.events).toHaveLength(1);
    expect(page.truncated).toBe(true);
    expect(occupancy).toEqual([
      {
        resourceType: 'DRIVER',
        resourcePublicId: primary.driver.publicId.toString(),
        travelDate: '2026-08-30',
        dispatchCount: 2,
        hasConflict: true,
      },
    ]);
  });

  it('reads and updates the singleton policy with an actor projection', async () => {
    const settings = new KyselyDispatchScheduleSettingsRepository(database);

    await expect(settings.getForShare()).resolves.toMatchObject({
      policy: 'WARN_AND_ACK',
      updatedByActorPublicId: null,
    });
    await expect(
      settings.update({
        policy: 'BLOCK',
        updatedByActorPublicId: dispatchActorPublicId.toString(),
        updatedAt: new Date('2026-08-29T01:00:00.000Z'),
      }),
    ).resolves.toEqual({
      policy: 'BLOCK',
      updatedByActorPublicId: dispatchActorPublicId.toString(),
      updatedAt: '2026-08-29T01:00:00.000Z',
    });
  });

  it('appends conflict evidence, finds exact coverage, and lists historical labels', async () => {
    const dispatches = new KyselyDispatchRepository(database);
    const overrides = new KyselyDispatchConflictOverrideRepository(database);
    const target = draft(6, primary);
    const conflicting = draft(7, { ...primary, vehicle: alternate.vehicle });
    await dispatches.insert(target);
    await dispatches.insert(conflicting);

    await overrides.appendMany([
      {
        publicId: dispatchPublicId(899).toString(),
        dispatchPublicId: target.publicId.toString(),
        conflictingDispatchPublicId: conflicting.publicId.toString(),
        conflictType: 'DRIVER',
        policy: 'WARN_AND_ACK',
        reason: 'Reviewed both schedules and approved this second trip.',
        acknowledgedByActorPublicId: dispatchActorPublicId.toString(),
        acknowledgedAt: '2026-08-29T02:00:00.000Z',
      },
    ]);

    await expect(
      overrides.hasMatchingEvidence({
        dispatchPublicId: target.publicId.toString(),
        conflictingDispatchPublicId: conflicting.publicId.toString(),
        conflictType: 'DRIVER',
      }),
    ).resolves.toBe(true);
    await expect(overrides.listForDispatch(target.publicId.toString())).resolves.toMatchObject([
      {
        conflictingDispatchPublicId: conflicting.publicId.toString(),
        conflictType: 'DRIVER',
        policy: 'WARN_AND_ACK',
        acknowledgedByActorPublicId: dispatchActorPublicId.toString(),
      },
    ]);
  });
});
