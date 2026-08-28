import { describe, expect, it, vi } from 'vitest';

import { CreateBudgetAllocation } from '@/application/budget/use-cases/create-budget-allocation';
import { GetBudgetAllocation } from '@/application/budget/use-cases/get-budget-allocation';
import { ListBudgetAllocations } from '@/application/budget/use-cases/list-budget-allocations';
import { ListOperationalBudgetAllocations } from '@/application/budget/use-cases/list-operational-budget-allocations';
import { RestoreBudgetAllocation } from '@/application/budget/use-cases/restore-budget-allocation';
import { SoftDeleteBudgetAllocation } from '@/application/budget/use-cases/soft-delete-budget-allocation';
import { UpdateBudgetAllocation } from '@/application/budget/use-cases/update-budget-allocation';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';

import { createBudgetTestDependencies, publicId, requestContext } from './budget-test-helpers';

const at = new Date('2026-08-28T10:00:00.000Z');

function office(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): Office {
  return new Office({
    publicId: publicId(420),
    name: OfficeName.from('Provincial Budget Office'),
    abbreviation: OfficeAbbreviation.from('PBO'),
    status: OfficeStatus.from(status),
    createdAt: at,
    updatedAt: at,
  });
}

function allocation(status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' = 'DRAFT') {
  return new BudgetAllocation({
    publicId: publicId(421),
    ppmpNumber: PpmpNumber.from('PPMP-2026-01'),
    officePublicId: office().publicId,
    quarter: Quarter.from(3),
    fiscalYear: FiscalYear.from(2026),
    status: BudgetAllocationStatus.from(status),
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
  pageSize: 25,
} as const;

describe('budget allocation use cases', () => {
  it('creates a normalized draft for an operational locked office and audits atomically', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValue(office());

    const result = await new CreateBudgetAllocation(dependencies).execute({
      context: requestContext(['budget.manage']),
      command: {
        ppmpNumber: '  ppmp-2026-01 ',
        officePublicId: office().publicId.toString(),
        quarter: 3,
        fiscalYear: 2026,
      },
    });

    expect(result).toMatchObject({
      ppmpNumber: 'PPMP-2026-01',
      status: 'DRAFT',
      office: { name: 'Provincial Budget Office', abbreviation: 'PBO' },
    });
    expect(repositories.allocations.insert).toHaveBeenCalledOnce();
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'budget_allocation.created' }),
    );
  });

  it('rejects creation for a missing or inactive office without persistence or audit', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValueOnce(
      office('INACTIVE'),
    );
    const useCase = new CreateBudgetAllocation(dependencies);
    const input = {
      context: requestContext(['budget.manage']),
      command: {
        ppmpNumber: 'PPMP-2026-01',
        officePublicId: office().publicId.toString(),
        quarter: 3,
        fiscalYear: 2026,
      },
    } as const;

    await expect(useCase.execute(input)).rejects.toMatchObject({ httpStatus: 422 });
    await expect(useCase.execute(input)).rejects.toMatchObject({ httpStatus: 404 });
    expect(repositories.allocations.insert).not.toHaveBeenCalled();
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });

  it('edits draft identity, checks reassigned offices, and emits one update event', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const target = allocation();
    const reassigned = new Office({
      ...office(),
      publicId: publicId(422),
    });
    vi.mocked(repositories.allocations.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValue(reassigned);
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValue(reassigned);

    const result = await new UpdateBudgetAllocation(dependencies).execute({
      context: requestContext(['budget.manage']),
      publicId: target.publicId.toString(),
      command: {
        action: 'update',
        ppmpNumber: 'PPMP-2026-02',
        officePublicId: reassigned.publicId.toString(),
        quarter: 4,
      },
    });

    expect(result).toMatchObject({ ppmpNumber: 'PPMP-2026-02', quarter: 4 });
    expect(repositories.allocations.updateDetails).toHaveBeenCalledOnce();
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'budget_allocation.updated' }),
    );
  });

  it('activates only with a current active office, then closes with distinct audit actions', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const target = allocation();
    vi.mocked(repositories.allocations.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    vi.mocked(repositories.offices.findCurrentByPublicIdForUpdate).mockResolvedValue(office());
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValue(office());
    const useCase = new UpdateBudgetAllocation(dependencies);

    expect(
      (
        await useCase.execute({
          context: requestContext(['budget.manage']),
          publicId: target.publicId.toString(),
          command: { action: 'activate' },
        })
      ).status,
    ).toBe('ACTIVE');
    expect(
      (
        await useCase.execute({
          context: requestContext(['budget.manage']),
          publicId: target.publicId.toString(),
          command: { action: 'close' },
        })
      ).status,
    ).toBe('CLOSED');
    expect(
      vi.mocked(repositories.auditEvents.append).mock.calls.map(([event]) => event.action),
    ).toEqual(['budget_allocation.activated', 'budget_allocation.closed']);
  });

  it('normalizes a cancellation reason into audit metadata and preserves terminal state', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const target = allocation('ACTIVE');
    vi.mocked(repositories.allocations.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValue(office());

    const result = await new UpdateBudgetAllocation(dependencies).execute({
      context: requestContext(['budget.manage']),
      publicId: target.publicId.toString(),
      command: { action: 'cancel', reason: '  Funding   source changed. ' },
    });

    expect(result.status).toBe('CANCELLED');
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'budget_allocation.cancelled',
        metadata: { reason: 'Funding source changed.' },
      }),
    );
  });

  it('soft-deletes with evidence and restores an active allocation as draft', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const target = allocation('ACTIVE');
    vi.mocked(repositories.allocations.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    await new SoftDeleteBudgetAllocation(dependencies).execute({
      context: requestContext(['budget.manage']),
      publicId: target.publicId.toString(),
      reason: '  Superseded   allocation record. ',
    });
    expect(target.deleteReason).toBe('Superseded allocation record.');
    expect(repositories.auditEvents.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'budget_allocation.deleted' }),
    );

    vi.mocked(repositories.allocations.findDeletedByPublicIdForUpdate).mockResolvedValue(target);
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValue(office());
    const restored = await new RestoreBudgetAllocation(dependencies).execute({
      context: requestContext(['budget.manage']),
      publicId: target.publicId.toString(),
    });
    expect(restored.status).toBe('DRAFT');
    expect(repositories.allocations.restore).toHaveBeenCalledOnce();
  });

  it('resolves operational queries through the Manila policy and requires read access', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const useCase = new ListOperationalBudgetAllocations(dependencies);

    await useCase.execute({
      context: requestContext(['budget.read']),
      query: {
        mode: 'operational',
        query: null,
        effectiveDate: '2027-01-01',
        cursor: null,
        pageSize: 50,
      },
    });
    expect(repositories.allocations.listOperational).toHaveBeenCalledWith({
      mode: 'operational',
      query: null,
      effectiveDate: '2027-01-01',
      fiscalYear: 2027,
      quarter: 1,
      cursor: null,
      pageSize: 50,
    });

    await expect(
      useCase.execute({
        context: requestContext(['office.read']),
        query: {
          mode: 'operational',
          query: null,
          effectiveDate: null,
          cursor: null,
          pageSize: 50,
        },
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('gets and lists historical records with current eligibility computed in the application', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const active = allocation('ACTIVE');
    vi.mocked(repositories.allocations.findIncludingDeletedByPublicId).mockResolvedValue(active);
    vi.mocked(repositories.offices.findIncludingDeletedByPublicId).mockResolvedValue(office());
    vi.mocked(repositories.allocations.listAdmin).mockResolvedValue({
      items: [
        {
          allocation: active,
          office: {
            publicId: office().publicId.toString(),
            name: 'Provincial Budget Office',
            abbreviation: 'PBO',
          },
          officeOperational: true,
        },
      ],
      nextCursor: null,
      previousCursor: null,
    });

    await expect(
      new GetBudgetAllocation(dependencies).execute({
        context: requestContext(['budget.read']),
        publicId: active.publicId.toString(),
      }),
    ).resolves.toMatchObject({ eligible: true });
    await expect(
      new ListBudgetAllocations(dependencies).execute({
        context: requestContext(['budget.read']),
        query: adminQuery,
      }),
    ).resolves.toMatchObject({ items: [expect.objectContaining({ eligible: true })] });
  });

  it('rejects empty updates, invalid reasons, terminal transitions, and unauthorized mutations', async () => {
    const { dependencies, repositories } = createBudgetTestDependencies();
    const target = allocation('CLOSED');
    vi.mocked(repositories.allocations.findCurrentByPublicIdForUpdate).mockResolvedValue(target);
    const update = new UpdateBudgetAllocation(dependencies);

    await expect(
      update.execute({
        context: requestContext(['budget.manage']),
        publicId: target.publicId.toString(),
        command: { action: 'update' },
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
    await expect(
      update.execute({
        context: requestContext(['budget.manage']),
        publicId: target.publicId.toString(),
        command: { action: 'activate' },
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
    await expect(
      update.execute({
        context: requestContext(['budget.manage']),
        publicId: target.publicId.toString(),
        command: { action: 'cancel', reason: 'short' },
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
    await expect(
      new SoftDeleteBudgetAllocation(dependencies).execute({
        context: requestContext(['budget.read']),
        publicId: target.publicId.toString(),
        reason: 'Valid deletion reason.',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
    expect(repositories.auditEvents.append).not.toHaveBeenCalled();
  });
});
