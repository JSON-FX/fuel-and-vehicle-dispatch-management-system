import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CreateInitialSuperAdmin } from '@/application/auth/use-cases/create-initial-super-admin';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { SequencePublicIdGenerator } from '../../unit/application/auth/support/auth-fakes';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let useCase: CreateInitialSuperAdmin;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`delete from fuel_ledger_entries`.execute(database);
  await sql`delete from fuel_issuances`.execute(database);
  await sql`delete from fuel_sequence_monthly`.execute(database);
  await sql`delete from budget_allocations`.execute(database);
  await sql`delete from vehicles`.execute(database);
  await sql`delete from drivers`.execute(database);
  await sql`delete from offices`.execute(database);
  await sql`delete from user_roles`.execute(database);
  await sql`delete from users`.execute(database);
  useCase = new CreateInitialSuperAdmin({
    transaction: new KyselyAuthTransaction(database),
    passwordHasher: new Argon2PasswordHasher(),
    tokenGenerator: {
      generateTemporaryPassword: () => 'OneTimeCredential123456',
    } as never,
    publicIds: new SequencePublicIdGenerator(),
    clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
  });
});

afterAll(async () => database.destroy());

describe('initial super administrator', () => {
  it('creates one forced-change SUPER_ADMIN and refuses a second bootstrap', async () => {
    const result = await useCase.execute({
      fullName: 'System Administrator',
      username: ' System.Admin ',
      email: 'SYSTEM.ADMIN@example.lan',
      requestId: 'request-one',
    });
    const stored = await database
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.username',
        'users.email',
        'users.password_hash',
        'users.must_change_password',
        'roles.code',
      ])
      .executeTakeFirstOrThrow();

    expect(result.temporaryPassword).toBe('OneTimeCredential123456');
    expect(stored).toMatchObject({
      username: 'system.admin',
      email: 'system.admin@example.lan',
      must_change_password: 1,
      code: 'SUPER_ADMIN',
    });
    expect(stored.password_hash).not.toContain(result.temporaryPassword);
    await expect(
      useCase.execute({
        fullName: 'Second Admin',
        username: 'second.admin',
        email: 'second@example.lan',
        requestId: 'request-two',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
