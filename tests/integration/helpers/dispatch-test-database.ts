import type { Kysely } from 'kysely';

import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';
import { createMigrator } from '@/infrastructure/database/migrator';
import { KyselyDriverRepository } from '@/infrastructure/database/master-data/kysely-driver-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import { KyselyVehicleRepository } from '@/infrastructure/database/master-data/kysely-vehicle-repository';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import { KyselyDispatchTransaction } from '@/infrastructure/database/dispatch/kysely-dispatch-transaction';
import { NodeSha256DispatchConflictFingerprinter } from '@/infrastructure/dispatch/node-sha256-dispatch-conflict-fingerprinter';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

export const dispatchPublicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);

export const dispatchActorPublicId = dispatchPublicId(701);
export const dispatchTestAt = new Date('2026-08-28T10:00:00.000Z');

export const dispatchContext = {
  principal: {
    userPublicId: dispatchActorPublicId.toString(),
    username: 'dispatch.officer',
    fullName: 'Dispatch Officer',
    roles: ['DISPATCH_OFFICER'],
    permissions: [
      'dispatch.create',
      'dispatch.read',
      'dispatch.update',
      'dispatch.complete',
      'dispatch.cancel',
      'dispatch.conflict.override',
    ],
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  },
  requestId: 'dispatch-integration',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
} as const;

export interface DispatchReferenceFixture {
  readonly office: Office;
  readonly driver: Driver;
  readonly vehicle: Vehicle;
}

export function dispatchDependencies(database: Kysely<Database>): DispatchUseCaseDependencies {
  return {
    transaction: new KyselyDispatchTransaction(database),
    permissions: new DispatchPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => dispatchTestAt },
    conflictFingerprints: new NodeSha256DispatchConflictFingerprinter(),
  };
}

export function dispatchDraftCommand(references: DispatchReferenceFixture, suffix: string) {
  return {
    entryDate: '2026-08-28',
    travelDate: '2026-08-29',
    driverPublicId: references.driver.publicId.toString(),
    vehiclePublicId: references.vehicle.publicId.toString(),
    requestingOfficePublicId: references.office.publicId.toString(),
    destination: `District Hospital ${suffix}`,
    purpose: `Dispatch integration proof ${suffix}`,
    odoBefore: '1250.4',
    passengerCount: 2,
  };
}

export async function prepareDispatchDatabase(database: Kysely<Database>): Promise<void> {
  const migration = await createMigrator(database).migrateToLatest();
  if (migration.error !== undefined) throw migration.error;
  await resetDispatchDatabase(database);
}

export async function resetDispatchDatabase(database: Kysely<Database>): Promise<void> {
  await database.withSchema('fvdms_audit').deleteFrom('audit_outbox').execute();
  await database.deleteFrom('vehicle_dispatch_conflict_overrides').execute();
  await database
    .updateTable('dispatch_schedule_settings')
    .set({
      policy: 'WARN_AND_ACK',
      updated_by_user_id: null,
      updated_at: new Date('2026-08-29T00:00:00.000Z'),
    })
    .where('id', '=', 1)
    .execute();
  await database.deleteFrom('vehicle_dispatches').execute();
  await database.deleteFrom('fuel_ledger_entries').execute();
  await database.deleteFrom('fuel_issuances').execute();
  await database.deleteFrom('fuel_sequence_monthly').execute();
  await database.deleteFrom('budget_allocations').execute();
  await database.deleteFrom('vehicles').execute();
  await database.deleteFrom('drivers').execute();
  await database.deleteFrom('offices').execute();
  await database.deleteFrom('user_totp_factors').execute();
  await database.deleteFrom('user_sessions').execute();
  await database.deleteFrom('user_roles').execute();
  await database.deleteFrom('users').execute();

  await database
    .insertInto('users')
    .values({
      public_id: publicIdToBinary(dispatchActorPublicId),
      username: 'dispatch.officer',
      email: 'dispatch.officer@example.lan',
      full_name: 'Dispatch Officer',
      password_hash: 'test-only',
      is_active: true,
      must_change_password: false,
      deleted_at: null,
      created_at: dispatchTestAt,
      updated_at: dispatchTestAt,
    })
    .execute();
}

export async function seedDispatchReferences(
  database: Kysely<Database>,
  offset = 0,
): Promise<DispatchReferenceFixture> {
  const office = new Office({
    publicId: dispatchPublicId(710 + offset),
    name: OfficeName.from(`Provincial Services Office ${offset}`),
    abbreviation: OfficeAbbreviation.from(`P${String(offset).padStart(2, '0')}`),
    createdAt: dispatchTestAt,
    updatedAt: dispatchTestAt,
  });
  const driver = new Driver({
    publicId: dispatchPublicId(720 + offset),
    name: DriverName.from(`Dispatch Driver ${offset}`),
    contactNumber: DriverContactNumber.optional(`0917000${String(offset).padStart(4, '0')}`),
    createdAt: dispatchTestAt,
    updatedAt: dispatchTestAt,
  });
  const vehicle = new Vehicle({
    publicId: dispatchPublicId(730 + offset),
    modelBrand: ModelBrand.from(`Toyota Hiace ${offset}`),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from(`DSP-${String(offset).padStart(3, '0')}`),
    remarks: VehicleRemarks.optional('Dispatch pool vehicle'),
    createdAt: dispatchTestAt,
    updatedAt: dispatchTestAt,
  });

  await new KyselyOfficeRepository(database).insert(office);
  await new KyselyDriverRepository(database).insert(driver);
  await new KyselyVehicleRepository(database).insert(vehicle);
  return { office, driver, vehicle };
}
