import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { DispatchListQuery } from '@/application/dispatch/dto/dispatch-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import { KyselyDispatchRepository } from '@/infrastructure/database/dispatch/kysely-dispatch-repository';
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
let references: DispatchReferenceFixture;

const listQuery = (overrides: Partial<DispatchListQuery> = {}): DispatchListQuery => ({
  query: null,
  status: null,
  requestingOfficePublicId: null,
  travelDateFrom: null,
  travelDateTo: null,
  cursor: null,
  pageSize: 50,
  ...overrides,
});

function draft(
  suffix: number,
  travelDate: string,
  refs: DispatchReferenceFixture = references,
): VehicleDispatch {
  return new VehicleDispatch({
    publicId: dispatchPublicId(740 + suffix),
    entryDate: DispatchDate.from('2026-08-28'),
    travelDate: DispatchDate.from(travelDate),
    driverPublicId: refs.driver.publicId,
    vehiclePublicId: refs.vehicle.publicId,
    requestingOfficePublicId: refs.office.publicId,
    destination: `District Hospital ${suffix}`,
    purpose: `Deliver medical supplies ${suffix}`,
    odoBefore: OdometerReading.from(`${1250 + suffix}.4`),
    passengerCount: PassengerCount.from(suffix),
    createdByActorPublicId: dispatchActorPublicId,
    createdAt: dispatchTestAt,
    updatedAt: dispatchTestAt,
  });
}

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareDispatchDatabase(database);
});

beforeEach(async () => {
  await resetDispatchDatabase(database);
  references = await seedDispatchReferences(database);
});

afterAll(async () => {
  await database.destroy();
});

describe('KyselyDispatchRepository', () => {
  it('inserts and maps exact values with compact historical references', async () => {
    const repository = new KyselyDispatchRepository(database);
    const target = draft(1, '2026-08-29');

    await repository.insert(target);
    const result = await repository.findByPublicId(target.publicId.toString());

    expect(result?.dispatch.odoBefore.toString()).toBe('1251.4');
    expect(result?.dispatch.travelDate.toString()).toBe('2026-08-29');
    expect(result?.driver).toEqual({
      publicId: references.driver.publicId.toString(),
      name: 'Dispatch Driver 0',
    });
    expect(result?.driver).not.toHaveProperty('contactNumber');
    expect(result?.vehicle.plateNumber).toBe('DSP-000');
    expect(result?.requestingOffice.abbreviation).toBe('P00');
  });

  it('preserves joined labels after linked master data is soft-deleted', async () => {
    const repository = new KyselyDispatchRepository(database);
    const target = draft(2, '2026-08-29');
    await repository.insert(target);
    const actor = await database
      .selectFrom('users')
      .select('id')
      .where('username', '=', 'dispatch.officer')
      .executeTakeFirst();
    const deletedByUserId = actor?.id;
    if (deletedByUserId === undefined) throw new Error('Dispatch test actor is unavailable.');

    await database
      .updateTable('drivers')
      .set({
        status: 'INACTIVE',
        deleted_at: dispatchTestAt,
        deleted_by_user_id: deletedByUserId,
        delete_reason: 'Historical dispatch reference proof.',
      })
      .execute();
    await database
      .updateTable('vehicles')
      .set({
        status: 'UNSERVICEABLE',
        deleted_at: dispatchTestAt,
        deleted_by_user_id: deletedByUserId,
        delete_reason: 'Historical dispatch reference proof.',
      })
      .execute();
    await database
      .updateTable('offices')
      .set({
        status: 'INACTIVE',
        deleted_at: dispatchTestAt,
        deleted_by_user_id: deletedByUserId,
        delete_reason: 'Historical dispatch reference proof.',
      })
      .execute();

    const result = await repository.findByPublicId(target.publicId.toString());
    expect(result?.driver.name).toBe('Dispatch Driver 0');
    expect(result?.vehicle.modelBrand).toBe('Toyota Hiace 0');
    expect(result?.requestingOffice.name).toBe('Provincial Services Office 0');
  });

  it('persists draft edits and both lifecycle terminal shapes', async () => {
    const repository = new KyselyDispatchRepository(database);
    const completed = draft(3, '2026-08-29');
    await repository.insert(completed);
    completed.updateDetails(
      {
        entryDate: DispatchDate.from('2026-08-27'),
        travelDate: DispatchDate.from('2026-08-30'),
        driverPublicId: references.driver.publicId,
        vehiclePublicId: references.vehicle.publicId,
        requestingOfficePublicId: references.office.publicId,
        destination: 'Regional Medical Center',
        purpose: 'Transport clinical personnel',
        odoBefore: OdometerReading.from('1400.0'),
        passengerCount: PassengerCount.from(5),
      },
      new Date('2026-08-28T11:00:00.000Z'),
    );
    await repository.updateDetails(completed);
    completed.markDispatched(new Date('2026-08-28T12:00:00.000Z'));
    await repository.updateLifecycle(completed);
    completed.complete(OdometerReading.from('1410.5'), new Date('2026-08-28T13:00:00.000Z'));
    await repository.updateLifecycle(completed);

    const completedResult = await repository.findByPublicId(completed.publicId.toString());
    expect(completedResult?.dispatch).toMatchObject({
      destination: 'Regional Medical Center',
      cancellationReason: null,
    });
    expect(completedResult?.dispatch.status.toString()).toBe('COMPLETED');
    expect(completedResult?.dispatch.distance).toBe('10.5');

    const cancelled = draft(4, '2026-08-30');
    await repository.insert(cancelled);
    cancelled.cancel({
      at: new Date('2026-08-28T14:00:00.000Z'),
      actorPublicId: dispatchActorPublicId,
      reason: 'Vehicle reassigned for emergency response.',
    });
    await repository.updateLifecycle(cancelled);
    const cancelledResult = await repository.findByPublicId(cancelled.publicId.toString());
    expect(cancelledResult?.dispatch.status.toString()).toBe('CANCELLED');
    expect(cancelledResult?.dispatch.cancellationReason).toBe(
      'Vehicle reassigned for emergency response.',
    );
  });

  it('filters joined text and returns stable forward and previous keyset pages', async () => {
    const repository = new KyselyDispatchRepository(database);
    const otherReferences = await seedDispatchReferences(database, 1);
    await repository.insert(draft(5, '2026-08-31'));
    await repository.insert(draft(6, '2026-08-30'));
    await repository.insert(draft(7, '2026-08-29', otherReferences));

    const first = await repository.list(listQuery({ pageSize: 2 }));
    expect(first.items.map((item) => item.dispatch.travelDate.toString())).toEqual([
      '2026-08-31',
      '2026-08-30',
    ]);
    expect(first.previousCursor).toBeNull();
    expect(first.nextCursor).not.toBeNull();

    const second = await repository.list(listQuery({ pageSize: 2, cursor: first.nextCursor }));
    expect(second.items.map((item) => item.dispatch.travelDate.toString())).toEqual(['2026-08-29']);
    expect(second.previousCursor).not.toBeNull();
    expect(second.nextCursor).toBeNull();

    const previous = await repository.list(
      listQuery({ pageSize: 2, cursor: second.previousCursor }),
    );
    expect(previous.items.map((item) => item.dispatch.travelDate.toString())).toEqual([
      '2026-08-31',
      '2026-08-30',
    ]);

    const search = await repository.list(
      listQuery({
        query: 'Dispatch Driver 1',
        requestingOfficePublicId: otherReferences.office.publicId.toString(),
      }),
    );
    expect(search.items).toHaveLength(1);
    expect(search.items[0]?.dispatch.publicId.toString()).toBe(
      draft(7, '2026-08-29', otherReferences).publicId.toString(),
    );

    await expect(
      repository.list(listQuery({ pageSize: 2, cursor: first.nextCursor, status: 'DRAFT' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
