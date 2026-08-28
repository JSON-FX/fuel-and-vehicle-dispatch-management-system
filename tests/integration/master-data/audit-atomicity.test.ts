import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { CreateOffice } from '@/application/office/use-cases/create-office';
import type { MasterDataTransaction } from '@/application/master-data/ports/master-data-transaction';
import { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';
import type { Database } from '@/infrastructure/database/types';
import { createKyselyMasterDataRepositories } from '@/infrastructure/database/master-data/create-kysely-master-data-repositories';
import { KyselyMasterDataTransaction } from '@/infrastructure/database/master-data/kysely-master-data-transaction';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import {
  masterDataAdministratorPublicId,
  prepareMasterDataDatabase,
  resetMasterDataDatabase,
} from '../helpers/master-data-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
const principal: CurrentPrincipal = {
  userPublicId: masterDataAdministratorPublicId.toString(),
  username: 'master.data.admin',
  fullName: 'Master Data Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['office.manage'],
  isPrivileged: true,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const context = {
  principal,
  requestId: 'atomicity-test',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
};

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareMasterDataDatabase(database);
});
beforeEach(async () => resetMasterDataDatabase(database));
afterAll(async () => database.destroy());

function createUseCase(transaction: MasterDataTransaction): CreateOffice {
  return new CreateOffice({
    transaction,
    permissions: new MasterDataPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => new Date() },
  });
}

describe('master-data audit atomicity', () => {
  it('rolls back the business row when audit append fails', async () => {
    const transaction: MasterDataTransaction = {
      execute: (work) =>
        database.transaction().execute((trx) => {
          const repositories = createKyselyMasterDataRepositories(trx);
          return work({
            ...repositories,
            auditEvents: {
              append: async () => {
                throw new Error('forced audit failure');
              },
            },
          });
        }),
    };
    await expect(
      createUseCase(transaction).execute({
        context,
        command: { name: 'Atomic Office', abbreviation: 'AO' },
      }),
    ).rejects.toThrow('forced audit failure');
    expect(await database.selectFrom('offices').selectAll().execute()).toEqual([]);
  });

  it('commits the business row and matching audit outbox event together', async () => {
    await createUseCase(new KyselyMasterDataTransaction(database)).execute({
      context,
      command: { name: 'Atomic Office', abbreviation: 'AO' },
    });
    expect(await database.selectFrom('offices').selectAll().execute()).toHaveLength(1);
    expect(
      await database
        .withSchema('fvdms_audit')
        .selectFrom('audit_outbox')
        .select(['action', 'entity_type'])
        .execute(),
    ).toEqual([{ action: 'office.created', entity_type: 'office' }]);
  });
});
