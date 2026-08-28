import { type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';
import { createMigrator } from '@/infrastructure/database/migrator';
import { KyselyDriverRepository } from '@/infrastructure/database/master-data/kysely-driver-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import { KyselyVehicleRepository } from '@/infrastructure/database/master-data/kysely-vehicle-repository';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { createTestDatabase } from '../helpers/test-database';

const publicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);
const at = new Date('2026-08-28T05:00:00.000Z');
const adminId = publicId(1);
const query = {
  mode: 'admin',
  query: null,
  lifecycle: 'current',
  status: null,
  cursor: null,
  pageSize: 2,
} as const;

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
});

beforeEach(async () => {
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
      public_id: publicIdToBinary(adminId),
      username: 'master.admin',
      email: 'master.admin@example.lan',
      full_name: 'Master Data Administrator',
      password_hash: 'test-only',
      is_active: true,
      must_change_password: false,
      deleted_at: null,
      created_at: at,
      updated_at: at,
    })
    .execute();
});

afterAll(async () => {
  await database.destroy();
});

function office(value: number, name: string, abbreviation: string): Office {
  return new Office({
    publicId: publicId(value),
    name: OfficeName.from(name),
    abbreviation: OfficeAbbreviation.from(abbreviation),
    createdAt: at,
    updatedAt: at,
  });
}

function driver(value: number, name: string, contact: string | null): Driver {
  return new Driver({
    publicId: publicId(value),
    name: DriverName.from(name),
    contactNumber: DriverContactNumber.optional(contact),
    createdAt: at,
    updatedAt: at,
  });
}

function vehicle(value: number, plate: string): Vehicle {
  return new Vehicle({
    publicId: publicId(value),
    modelBrand: ModelBrand.from('Toyota Hiace'),
    vehicleType: VehicleType.from('Passenger Van'),
    plateNumber: PlateNumber.from(plate),
    remarks: null,
    createdAt: at,
    updatedAt: at,
  });
}

describe('office repository', () => {
  it('paginates office rows without duplicates and binds cursors to filters', async () => {
    const repository = new KyselyOfficeRepository(database);
    await repository.insert(office(10, 'Accounting Office', 'AO'));
    await repository.insert(office(11, 'Budget Office', 'BO'));
    await repository.insert(office(12, 'Engineering Office', 'EO'));

    const first = await repository.listAdmin(query);
    expect(first.items.map((item) => item.name)).toEqual(['Accounting Office', 'Budget Office']);
    expect(first.nextCursor).not.toBeNull();
    const second = await repository.listAdmin({ ...query, cursor: first.nextCursor });
    expect(second.items.map((item) => item.name)).toEqual(['Engineering Office']);
    expect(new Set([...first.items, ...second.items].map((item) => item.publicId)).size).toBe(3);
    await expect(
      repository.listAdmin({ ...query, query: 'office', cursor: first.nextCursor }),
    ).rejects.toThrow();
  });

  it('maps office unique conflicts to their fields', async () => {
    const repository = new KyselyOfficeRepository(database);
    await repository.insert(office(13, 'Budget Office', 'BO'));
    await expect(repository.insert(office(14, 'budget office', 'OTHER'))).rejects.toMatchObject({
      httpStatus: 409,
      details: [{ field: 'name' }],
    });
    await expect(repository.insert(office(15, 'Other Office', 'bo'))).rejects.toMatchObject({
      details: [{ field: 'abbreviation' }],
    });
  });

  it('preserves office deletion evidence and restores non-operational', async () => {
    const repository = new KyselyOfficeRepository(database);
    const target = office(16, 'Deleted Office', 'DO');
    await repository.insert(target);
    target.softDelete({ at, actorPublicId: adminId, reason: 'Office reference is obsolete.' });
    await repository.softDelete(target);
    expect(await repository.findCurrentByPublicId(target.publicId.toString())).toBeNull();
    expect(
      await repository.findIncludingDeletedByPublicId(target.publicId.toString()),
    ).toMatchObject({
      deleteReason: 'Office reference is obsolete.',
    });
    target.restore(at);
    await repository.restore(target);
    const restored = await repository.findCurrentByPublicId(target.publicId.toString());
    expect(restored?.status.toString()).toBe('INACTIVE');
    expect(restored?.isOperational()).toBe(false);
  });
});

describe('driver repository', () => {
  it('allows duplicate driver names and keeps contacts out of operational options', async () => {
    const repository = new KyselyDriverRepository(database);
    await repository.insert(driver(20, 'Juan Dela Cruz', '0917 123 4567'));
    await repository.insert(driver(21, 'Juan Dela Cruz', '0999 000 0000'));
    const options = await repository.listOperational({ ...query, mode: 'operational' });
    expect(options.items).toHaveLength(2);
    expect(options.items[0]).not.toHaveProperty('contactNumber');
    expect(JSON.stringify(options)).not.toContain('0917');
  });

  it('excludes inactive and deleted drivers from operational results', async () => {
    const repository = new KyselyDriverRepository(database);
    const inactive = driver(22, 'Inactive Driver', null);
    inactive.changeStatus(DriverStatus.inactive(), at);
    await repository.insert(inactive);
    const deleted = driver(23, 'Deleted Driver', null);
    await repository.insert(deleted);
    deleted.softDelete({
      at,
      actorPublicId: adminId,
      reason: 'Driver record is no longer current.',
    });
    await repository.softDelete(deleted);
    expect((await repository.listOperational({ ...query, mode: 'operational' })).items).toEqual([]);
    expect(
      await repository.findIncludingDeletedByPublicId(deleted.publicId.toString()),
    ).not.toBeNull();
  });
});

describe('vehicle repository', () => {
  it('maps vehicle plate conflicts and reserves deleted plates', async () => {
    const repository = new KyselyVehicleRepository(database);
    const target = vehicle(30, 'ABC-123');
    await repository.insert(target);
    target.softDelete({ at, actorPublicId: adminId, reason: 'Vehicle reference is obsolete.' });
    await repository.softDelete(target);
    await expect(repository.insert(vehicle(31, 'abc-123'))).rejects.toMatchObject({
      httpStatus: 409,
      details: [{ field: 'plateNumber' }],
    });
  });

  it('returns only current serviceable vehicles to operational selectors', async () => {
    const repository = new KyselyVehicleRepository(database);
    await repository.insert(vehicle(32, 'AAA-100'));
    const unserviceable = vehicle(33, 'BBB-200');
    unserviceable.changeStatus(VehicleStatus.unserviceable(), at);
    await repository.insert(unserviceable);
    const options = await repository.listOperational({ ...query, mode: 'operational' });
    expect(options.items).toEqual([
      expect.objectContaining({ plateNumber: 'AAA-100', label: 'AAA-100 · Toyota Hiace' }),
    ]);
  });
});
