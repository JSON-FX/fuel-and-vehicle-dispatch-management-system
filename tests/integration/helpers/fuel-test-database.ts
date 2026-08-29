import type { Kysely } from 'kysely';

import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import { FuelPermissionPolicy } from '@/application/fuel/services/fuel-permission-policy';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
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
import { KyselyBudgetAllocationRepository } from '@/infrastructure/database/budget/kysely-budget-allocation-repository';
import { createMigrator } from '@/infrastructure/database/migrator';
import { KyselyDriverRepository } from '@/infrastructure/database/master-data/kysely-driver-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import { KyselyVehicleRepository } from '@/infrastructure/database/master-data/kysely-vehicle-repository';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';
import { KyselyFuelTransaction } from '@/infrastructure/database/fuel/kysely-fuel-transaction';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

export const fuelPublicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);

export const fuelActorPublicId = fuelPublicId(601);
export const fuelTestAt = new Date('2026-08-28T10:00:00.000Z');

export const fuelContext = {
  principal: {
    userPublicId: fuelActorPublicId.toString(),
    username: 'fuel.staff',
    fullName: 'Fuel Staff',
    roles: ['PSMD_STAFF'],
    permissions: ['fuel.create', 'fuel.read', 'fuel.post', 'fuel.void'],
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: false,
  },
  requestId: 'fuel-integration',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
} as const;

export function fuelDependencies(database: Kysely<Database>): FuelUseCaseDependencies {
  return {
    transaction: new KyselyFuelTransaction(database),
    permissions: new FuelPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => fuelTestAt },
    fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
  };
}

export function fuelDraftCommand(references: FuelReferenceFixture, suffix: string) {
  return {
    purchaseRequestNumber: `PR-2026-${suffix}`,
    entryDate: '2026-08-28',
    driverPublicId: references.driver.publicId.toString(),
    purpose: `Fuel integration proof ${suffix}`,
    vehiclePublicId: references.vehicle.publicId.toString(),
    requestedLiters: '30',
    isFullTank: false,
    unitPrice: '61.25',
    budgetAllocationPublicId: references.allocation.publicId.toString(),
    fuelType: 'DIESEL' as const,
  };
}

export interface FuelReferenceFixture {
  readonly office: Office;
  readonly driver: Driver;
  readonly vehicle: Vehicle;
  readonly allocation: BudgetAllocation;
}

export async function prepareFuelDatabase(database: Kysely<Database>): Promise<void> {
  const migration = await createMigrator(database).migrateToLatest();
  if (migration.error !== undefined) throw migration.error;
  await resetFuelDatabase(database);
}

export async function resetFuelDatabase(database: Kysely<Database>): Promise<void> {
  await database.withSchema('fvdms_audit').deleteFrom('audit_outbox').execute();
  await database.deleteFrom('export_download_tokens').execute();
  await database.deleteFrom('export_jobs').execute();
  await database.deleteFrom('vehicle_dispatch_conflict_overrides').execute();
  await database.deleteFrom('vehicle_dispatches').execute();
  await database.deleteFrom('fuel_ledger_entries').execute();
  await database.deleteFrom('fuel_issuances').execute();
  await database.deleteFrom('fuel_sequence_monthly').execute();
  await database
    .updateTable('dispatch_schedule_settings')
    .set({
      policy: 'WARN_AND_ACK',
      updated_by_user_id: null,
      updated_at: new Date('2026-08-29T00:00:00.000Z'),
    })
    .where('id', '=', 1)
    .execute();
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
      public_id: publicIdToBinary(fuelActorPublicId),
      username: 'fuel.staff',
      email: 'fuel.staff@example.lan',
      full_name: 'Fuel Staff',
      password_hash: 'test-only',
      is_active: true,
      must_change_password: false,
      deleted_at: null,
      created_at: fuelTestAt,
      updated_at: fuelTestAt,
    })
    .execute();
}

export async function seedFuelReferences(
  database: Kysely<Database>,
): Promise<FuelReferenceFixture> {
  const office = new Office({
    publicId: fuelPublicId(610),
    name: OfficeName.from('Provincial Services Office'),
    abbreviation: OfficeAbbreviation.from('PSO'),
    createdAt: fuelTestAt,
    updatedAt: fuelTestAt,
  });
  const driver = new Driver({
    publicId: fuelPublicId(611),
    name: DriverName.from('Juan Dela Cruz'),
    contactNumber: DriverContactNumber.optional('0917 123 4567'),
    createdAt: fuelTestAt,
    updatedAt: fuelTestAt,
  });
  const vehicle = new Vehicle({
    publicId: fuelPublicId(612),
    modelBrand: ModelBrand.from('Toyota Hiace'),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from('ABC-123'),
    remarks: VehicleRemarks.optional('Pool vehicle'),
    createdAt: fuelTestAt,
    updatedAt: fuelTestAt,
  });
  const allocation = new BudgetAllocation({
    publicId: fuelPublicId(613),
    ppmpNumber: PpmpNumber.from('PPMP-2026-01'),
    officePublicId: office.publicId,
    quarter: Quarter.from(3),
    fiscalYear: FiscalYear.from(2026),
    status: BudgetAllocationStatus.draft().activate(),
    createdAt: fuelTestAt,
    updatedAt: fuelTestAt,
  });

  await new KyselyOfficeRepository(database).insert(office);
  await new KyselyDriverRepository(database).insert(driver);
  await new KyselyVehicleRepository(database).insert(vehicle);
  await new KyselyBudgetAllocationRepository(database).insert(allocation);
  return { office, driver, vehicle, allocation };
}
