import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CreateOffice } from '@/application/office/use-cases/create-office';
import { UpdateOffice } from '@/application/office/use-cases/update-office';
import { CreateVehicle } from '@/application/vehicle/use-cases/create-vehicle';
import { UpdateVehicle } from '@/application/vehicle/use-cases/update-vehicle';
import { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { Database } from '@/infrastructure/database/types';
import { KyselyMasterDataTransaction } from '@/infrastructure/database/master-data/kysely-master-data-transaction';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { createTestDatabase } from '../helpers/test-database';
import {
  masterDataAdministratorPublicId,
  prepareMasterDataDatabase,
  resetMasterDataDatabase,
} from '../helpers/master-data-test-database';

let database: Kysely<Database>;

const principal: CurrentPrincipal = {
  userPublicId: masterDataAdministratorPublicId.toString(),
  username: 'master.data.admin',
  fullName: 'Master Data Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['office.manage', 'vehicle.manage'],
  isPrivileged: true,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const context = {
  principal,
  requestId: 'concurrency-test',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
};

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareMasterDataDatabase(database);
});

beforeEach(async () => resetMasterDataDatabase(database));
afterAll(async () => database.destroy());

function dependencies() {
  return {
    transaction: new KyselyMasterDataTransaction(database),
    permissions: new MasterDataPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => new Date() },
  } as const;
}

function expectOneWinner(results: readonly PromiseSettledResult<unknown>[], field: string): void {
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const rejected = results.find((result) => result.status === 'rejected');
  expect(rejected).toMatchObject({
    status: 'rejected',
    reason: { httpStatus: 409, details: [{ field }] },
  });
}

describe('master-data concurrency', () => {
  it('lets exactly one concurrent office-name create win with one audit event', async () => {
    const useCase = new CreateOffice(dependencies());
    const results = await Promise.allSettled([
      useCase.execute({ context, command: { name: 'Budget Office', abbreviation: 'BO-1' } }),
      useCase.execute({ context, command: { name: 'budget office', abbreviation: 'BO-2' } }),
    ]);
    expectOneWinner(results, 'name');
    expect(await database.selectFrom('offices').selectAll().execute()).toHaveLength(1);
    expect(
      await database
        .withSchema('fvdms_audit')
        .selectFrom('audit_outbox')
        .selectAll()
        .where('action', '=', 'office.created')
        .execute(),
    ).toHaveLength(1);
  });

  it('lets exactly one concurrent office-abbreviation create win', async () => {
    const useCase = new CreateOffice(dependencies());
    const results = await Promise.allSettled([
      useCase.execute({ context, command: { name: 'First Office', abbreviation: 'PEO' } }),
      useCase.execute({ context, command: { name: 'Second Office', abbreviation: 'peo' } }),
    ]);
    expectOneWinner(results, 'abbreviation');
    expect(await database.selectFrom('offices').selectAll().execute()).toHaveLength(1);
  });

  it('lets exactly one concurrent vehicle-plate create win', async () => {
    const useCase = new CreateVehicle(dependencies());
    const command = {
      modelBrand: 'Toyota Hiace',
      vehicleType: 'Passenger Van',
      plateNumber: 'ABC-123',
    } as const;
    const results = await Promise.allSettled([
      useCase.execute({ context, command }),
      useCase.execute({ context, command: { ...command, plateNumber: 'abc-123' } }),
    ]);
    expectOneWinner(results, 'plateNumber');
    expect(await database.selectFrom('vehicles').selectAll().execute()).toHaveLength(1);
  });

  it('lets exactly one concurrent office-name update win with one update event', async () => {
    const create = new CreateOffice(dependencies());
    const first = await create.execute({
      context,
      command: { name: 'First Office', abbreviation: 'FIRST' },
    });
    const second = await create.execute({
      context,
      command: { name: 'Second Office', abbreviation: 'SECOND' },
    });
    const update = new UpdateOffice(dependencies());
    const results = await Promise.allSettled([
      update.execute({
        context,
        publicId: first.publicId,
        command: { name: 'Shared Office Name' },
      }),
      update.execute({
        context,
        publicId: second.publicId,
        command: { name: 'shared office name' },
      }),
    ]);
    expectOneWinner(results, 'name');
    expect(
      await database
        .withSchema('fvdms_audit')
        .selectFrom('audit_outbox')
        .selectAll()
        .where('action', '=', 'office.updated')
        .execute(),
    ).toHaveLength(1);
  });

  it('lets exactly one concurrent office-abbreviation update win', async () => {
    const create = new CreateOffice(dependencies());
    const first = await create.execute({
      context,
      command: { name: 'First Office', abbreviation: 'FIRST' },
    });
    const second = await create.execute({
      context,
      command: { name: 'Second Office', abbreviation: 'SECOND' },
    });
    const update = new UpdateOffice(dependencies());
    const results = await Promise.allSettled([
      update.execute({
        context,
        publicId: first.publicId,
        command: { abbreviation: 'SHARED' },
      }),
      update.execute({
        context,
        publicId: second.publicId,
        command: { abbreviation: 'shared' },
      }),
    ]);
    expectOneWinner(results, 'abbreviation');
  });

  it('lets exactly one concurrent vehicle-plate update win', async () => {
    const create = new CreateVehicle(dependencies());
    const first = await create.execute({
      context,
      command: { modelBrand: 'First Truck', vehicleType: 'Truck', plateNumber: 'ONE-100' },
    });
    const second = await create.execute({
      context,
      command: { modelBrand: 'Second Truck', vehicleType: 'Truck', plateNumber: 'TWO-200' },
    });
    const update = new UpdateVehicle(dependencies());
    const results = await Promise.allSettled([
      update.execute({
        context,
        publicId: first.publicId,
        command: { plateNumber: 'SHARED-300' },
      }),
      update.execute({
        context,
        publicId: second.publicId,
        command: { plateNumber: 'shared-300' },
      }),
    ]);
    expectOneWinner(results, 'plateNumber');
  });
});
