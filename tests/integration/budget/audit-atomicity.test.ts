import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import { CreateBudgetAllocation } from '@/application/budget/use-cases/create-budget-allocation';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { KyselyBudgetTransaction } from '@/infrastructure/database/budget/kysely-budget-transaction';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { prepareBudgetDatabase, resetBudgetDatabase } from '../helpers/budget-test-database';
import { createTestDatabase } from '../helpers/test-database';

const now = new Date('2026-08-28T10:00:00.000Z');
const officePublicId = PublicId.from('01900000-0000-7000-8000-000000000601');
const context = {
  principal: {
    userPublicId: '01900000-0000-7000-8000-000000000301',
    username: 'budget.admin',
    fullName: 'Budget Administrator',
    roles: ['BUDGET_OFFICER'],
    permissions: ['budget.manage'],
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: true,
  },
  requestId: 'budget-atomicity',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
} as const;

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareBudgetDatabase(database);
});

beforeEach(async () => {
  await resetBudgetDatabase(database);
  await new KyselyOfficeRepository(database).insert(
    new Office({
      publicId: officePublicId,
      name: OfficeName.from('Budget Office'),
      abbreviation: OfficeAbbreviation.from('BO'),
      createdAt: now,
      updatedAt: now,
    }),
  );
});

afterAll(async () => {
  await database.destroy();
});

function useCase(transaction: KyselyBudgetTransaction) {
  return new CreateBudgetAllocation({
    transaction,
    permissions: new BudgetPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => now },
    fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
  });
}

function command(ppmpNumber: string) {
  return {
    ppmpNumber,
    officePublicId: officePublicId.toString(),
    quarter: 3,
    fiscalYear: 2026,
  };
}

describe('budget allocation audit atomicity', () => {
  it('rolls back the allocation when audit append fails', async () => {
    const transaction = new KyselyBudgetTransaction(database, {
      primarySchema: 'missing_budget_audit',
      maximumCanonicalPayloadBytes: 65_536,
    });

    await expect(
      useCase(transaction).execute({ context, command: command('ROLLBACK-ME') }),
    ).rejects.toThrow();
    expect((await database.selectFrom('budget_allocations').select('id').execute()).length).toBe(0);
  });

  it('does not append another event when a duplicate tuple fails', async () => {
    const create = useCase(new KyselyBudgetTransaction(database));
    await create.execute({ context, command: command('UNIQUE-PPMP') });
    const before = await sql<{ count: string }>`
      select count(*) as count from fvdms_audit.audit_outbox
    `.execute(database);

    await expect(
      create.execute({ context, command: command(' unique-ppmp ') }),
    ).rejects.toMatchObject({ httpStatus: 409 });
    const after = await sql<{ count: string }>`
      select count(*) as count from fvdms_audit.audit_outbox
    `.execute(database);
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });
});
