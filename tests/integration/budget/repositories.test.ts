import { type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { KyselyBudgetAllocationRepository } from '@/infrastructure/database/budget/kysely-budget-allocation-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  budgetAdministratorPublicId,
  prepareBudgetDatabase,
  resetBudgetDatabase,
} from '../helpers/budget-test-database';
import { createTestDatabase } from '../helpers/test-database';

const publicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);
const at = new Date('2026-08-28T10:00:00.000Z');

let database: Kysely<Database>;
let offices: KyselyOfficeRepository;
let allocations: KyselyBudgetAllocationRepository;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareBudgetDatabase(database);
});

beforeEach(async () => {
  await resetBudgetDatabase(database);
  offices = new KyselyOfficeRepository(database);
  allocations = new KyselyBudgetAllocationRepository(database);
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

function allocation(input: {
  id: number;
  ppmp: string;
  office: Office;
  quarter?: number;
  year?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
}): BudgetAllocation {
  return new BudgetAllocation({
    publicId: publicId(input.id),
    ppmpNumber: PpmpNumber.from(input.ppmp),
    officePublicId: input.office.publicId,
    quarter: Quarter.from(input.quarter ?? 3),
    fiscalYear: FiscalYear.from(input.year ?? 2026),
    status: BudgetAllocationStatus.from(input.status ?? 'DRAFT'),
    createdAt: at,
    updatedAt: at,
  });
}

const adminQuery = {
  mode: 'admin',
  query: null,
  fiscalYear: null,
  quarter: null,
  status: null,
  lifecycle: 'current',
  cursor: null,
  pageSize: 2,
} as const;

describe('budget allocation repository', () => {
  it('lists joined administration records in stable fiscal order and binds cursors to filters', async () => {
    const budget = office(310, 'Provincial Budget Office', 'PBO');
    const engineering = office(311, 'Engineering Office', 'EO');
    await offices.insert(budget);
    await offices.insert(engineering);
    await allocations.insert(allocation({ id: 320, ppmp: 'PPMP-B', office: budget }));
    await allocations.insert(
      allocation({ id: 321, ppmp: 'PPMP-A', office: engineering, quarter: 4 }),
    );
    await allocations.insert(
      allocation({ id: 322, ppmp: 'PPMP-C', office: budget, year: 2025, quarter: 4 }),
    );

    const first = await allocations.listAdmin(adminQuery);
    expect(first.items.map((item) => item.allocation.ppmpNumber.toString())).toEqual([
      'PPMP-A',
      'PPMP-B',
    ]);
    expect(first.items[0]?.office).toMatchObject({
      name: 'Engineering Office',
      abbreviation: 'EO',
    });
    expect(first.nextCursor).not.toBeNull();

    const second = await allocations.listAdmin({ ...adminQuery, cursor: first.nextCursor });
    expect(second.items.map((item) => item.allocation.ppmpNumber.toString())).toEqual(['PPMP-C']);
    await expect(
      allocations.listAdmin({ ...adminQuery, fiscalYear: 2026, cursor: first.nextCursor }),
    ).rejects.toThrow();
  });

  it('searches PPMP and office labels and filters lifecycle, period, and status', async () => {
    const budget = office(330, 'Provincial Budget Office', 'PBO');
    await offices.insert(budget);
    const active = allocation({
      id: 331,
      ppmp: 'FY26-OPERATIONS',
      office: budget,
      status: 'ACTIVE',
    });
    const deleted = allocation({ id: 332, ppmp: 'FY25-ARCHIVE', office: budget, year: 2025 });
    await allocations.insert(active);
    await allocations.insert(deleted);
    deleted.softDelete({
      at,
      actorPublicId: budgetAdministratorPublicId,
      reason: 'Superseded budget allocation.',
    });
    await allocations.softDelete(deleted);

    const current = await allocations.listAdmin({
      ...adminQuery,
      query: 'provincial budget',
      fiscalYear: 2026,
      quarter: 3,
      status: 'ACTIVE',
    });
    expect(current.items.map((item) => item.allocation.publicId.toString())).toEqual([
      active.publicId.toString(),
    ]);

    const historical = await allocations.listAdmin({
      ...adminQuery,
      query: 'archive',
      lifecycle: 'deleted',
    });
    expect(historical.items[0]?.allocation.deleteReason).toBe('Superseded budget allocation.');
  });

  it('returns only matching active allocations linked to current active offices', async () => {
    const activeOffice = office(340, 'Active Office', 'AO');
    const inactiveOffice = office(341, 'Inactive Office', 'IO');
    inactiveOffice.changeStatus(OfficeStatus.inactive(), at);
    await offices.insert(activeOffice);
    await offices.insert(inactiveOffice);
    await allocations.insert(
      allocation({ id: 342, ppmp: 'ELIGIBLE', office: activeOffice, status: 'ACTIVE' }),
    );
    await allocations.insert(
      allocation({ id: 343, ppmp: 'DRAFT', office: activeOffice, status: 'DRAFT' }),
    );
    await allocations.insert(
      allocation({ id: 344, ppmp: 'PAST', office: activeOffice, status: 'ACTIVE', year: 2025 }),
    );
    await allocations.insert(
      allocation({ id: 345, ppmp: 'INACTIVE OFFICE', office: inactiveOffice, status: 'ACTIVE' }),
    );

    const page = await allocations.listOperational({
      mode: 'operational',
      query: null,
      effectiveDate: '2026-08-28',
      fiscalYear: 2026,
      quarter: 3,
      cursor: null,
      pageSize: 50,
    });

    expect(page.items).toEqual([
      expect.objectContaining({
        ppmpNumber: 'ELIGIBLE',
        office: {
          publicId: activeOffice.publicId.toString(),
          name: 'Active Office',
          abbreviation: 'AO',
        },
      }),
    ]);
  });

  it('reserves normalized tuples after deletion and restores active allocations as drafts', async () => {
    const budget = office(350, 'Budget Office', 'BO');
    await offices.insert(budget);
    const target = allocation({ id: 351, ppmp: '  ppmp  001 ', office: budget, status: 'ACTIVE' });
    await allocations.insert(target);
    target.softDelete({
      at,
      actorPublicId: budgetAdministratorPublicId,
      reason: 'Superseded budget allocation.',
    });
    await allocations.softDelete(target);

    await expect(
      allocations.insert(allocation({ id: 352, ppmp: 'PPMP 001', office: budget })),
    ).rejects.toMatchObject({ httpStatus: 409, details: [{ field: 'ppmpNumber' }] });
    expect(await allocations.findCurrentByPublicId(target.publicId.toString())).toBeNull();

    const deleted = await allocations.findDeletedByPublicIdForUpdate(target.publicId.toString());
    expect(deleted?.status.toString()).toBe('ACTIVE');
    deleted?.restore(new Date('2026-08-28T11:00:00.000Z'));
    await allocations.restore(deleted!);
    const restored = await allocations.findCurrentByPublicId(target.publicId.toString());
    expect(restored?.status.toString()).toBe('DRAFT');
  });

  it('keeps deleted office labels available to historical allocation reads', async () => {
    const historicalOffice = office(360, 'Historical Office', 'HO');
    await offices.insert(historicalOffice);
    const target = allocation({ id: 361, ppmp: 'HISTORICAL', office: historicalOffice });
    await allocations.insert(target);
    historicalOffice.softDelete({
      at,
      actorPublicId: budgetAdministratorPublicId,
      reason: 'Office is no longer current.',
    });
    await offices.softDelete(historicalOffice);

    const page = await allocations.listAdmin({ ...adminQuery, query: 'historical office' });
    expect(page.items[0]?.office).toMatchObject({ name: 'Historical Office', abbreviation: 'HO' });
    expect(
      await allocations.findIncludingDeletedByPublicId(target.publicId.toString()),
    ).not.toBeNull();
  });
});
