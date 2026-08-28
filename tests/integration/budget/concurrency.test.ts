import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import { CreateBudgetAllocation } from '@/application/budget/use-cases/create-budget-allocation';
import { UpdateBudgetAllocation } from '@/application/budget/use-cases/update-budget-allocation';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { KyselyBudgetAllocationRepository } from '@/infrastructure/database/budget/kysely-budget-allocation-repository';
import { KyselyBudgetTransaction } from '@/infrastructure/database/budget/kysely-budget-transaction';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { prepareBudgetDatabase, resetBudgetDatabase } from '../helpers/budget-test-database';
import { createTestDatabase } from '../helpers/test-database';

const publicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);
const now = new Date('2026-08-28T10:00:00.000Z');
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
  requestId: 'budget-concurrency',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
} as const;

let database: Kysely<Database>;
let office: Office;
let dependencies: BudgetUseCaseDependencies;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareBudgetDatabase(database);
});

beforeEach(async () => {
  await resetBudgetDatabase(database);
  office = new Office({
    publicId: publicId(501),
    name: OfficeName.from('Budget Office'),
    abbreviation: OfficeAbbreviation.from('BO'),
    createdAt: now,
    updatedAt: now,
  });
  await new KyselyOfficeRepository(database).insert(office);
  dependencies = {
    transaction: new KyselyBudgetTransaction(database),
    permissions: new BudgetPermissionPolicy(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => now },
    fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
  };
});

afterAll(async () => {
  await database.destroy();
});

function command(ppmpNumber: string) {
  return {
    ppmpNumber,
    officePublicId: office.publicId.toString(),
    quarter: 3,
    fiscalYear: 2026,
  };
}

describe('budget allocation concurrency', () => {
  it('allows exactly one identical normalized create and appends one audit event', async () => {
    const create = new CreateBudgetAllocation(dependencies);
    const results = await Promise.allSettled([
      create.execute({ context, command: command(' PPMP   RACE ') }),
      create.execute({ context, command: command('ppmp race') }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { httpStatus: 409 } });
    const audits = await sql<{ count: string }>`
      select count(*) as count
      from fvdms_audit.audit_outbox
      where action = 'budget_allocation.created'
    `.execute(database);
    expect(audits.rows[0]?.count).toBe('1');
  });

  it('allows exactly one draft update to claim a tuple', async () => {
    const repository = new KyselyBudgetAllocationRepository(database);
    const first = new BudgetAllocation({
      publicId: publicId(510),
      ppmpNumber: PpmpNumber.from('FIRST'),
      officePublicId: office.publicId,
      quarter: Quarter.from(3),
      fiscalYear: FiscalYear.from(2026),
      createdAt: now,
      updatedAt: now,
    });
    const second = new BudgetAllocation({
      publicId: publicId(511),
      ppmpNumber: PpmpNumber.from('SECOND'),
      officePublicId: office.publicId,
      quarter: Quarter.from(3),
      fiscalYear: FiscalYear.from(2026),
      createdAt: now,
      updatedAt: now,
    });
    await repository.insert(first);
    await repository.insert(second);
    const update = new UpdateBudgetAllocation(dependencies);
    const results = await Promise.allSettled(
      [first, second].map((target) =>
        update.execute({
          context,
          publicId: target.publicId.toString(),
          command: { action: 'update', ppmpNumber: 'CLAIMED' },
        }),
      ),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { httpStatus: 409 },
    });
  });

  it('serializes close and cancel so one winner leaves one terminal state', async () => {
    const repository = new KyselyBudgetAllocationRepository(database);
    const target = new BudgetAllocation({
      publicId: publicId(520),
      ppmpNumber: PpmpNumber.from('TERMINAL-RACE'),
      officePublicId: office.publicId,
      quarter: Quarter.from(3),
      fiscalYear: FiscalYear.from(2026),
      status: BudgetAllocationStatus.from('ACTIVE'),
      createdAt: now,
      updatedAt: now,
    });
    await repository.insert(target);
    const update = new UpdateBudgetAllocation(dependencies);
    const results = await Promise.allSettled([
      update.execute({
        context,
        publicId: target.publicId.toString(),
        command: { action: 'close' },
      }),
      update.execute({
        context,
        publicId: target.publicId.toString(),
        command: { action: 'cancel', reason: 'Cancelled during concurrency proof.' },
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { httpStatus: 422 },
    });
    expect(
      (await repository.findCurrentByPublicId(target.publicId.toString()))?.status.toString(),
    ).toMatch(/^(CLOSED|CANCELLED)$/);
  });
});
