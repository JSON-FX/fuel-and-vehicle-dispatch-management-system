import { describe, expect, it } from 'vitest';

import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const at = (hour: number) => new Date(`2026-08-28T${String(hour).padStart(2, '0')}:00:00.000Z`);

function createAllocation(): BudgetAllocation {
  return new BudgetAllocation({
    publicId: publicId('000000000101'),
    ppmpNumber: PpmpNumber.from('  001-a /  field   support  '),
    officePublicId: publicId('000000000102'),
    quarter: Quarter.from(2),
    fiscalYear: FiscalYear.from(2026),
    createdAt: at(0),
    updatedAt: at(0),
  });
}

describe('budget allocation domain', () => {
  it('normalizes PPMP identity and creates a draft allocation', () => {
    const allocation = createAllocation();

    expect(allocation.ppmpNumber.toString()).toBe('001-A / FIELD SUPPORT');
    expect(allocation.quarter.toNumber()).toBe(2);
    expect(allocation.fiscalYear.toNumber()).toBe(2026);
    expect(allocation.status.toString()).toBe('DRAFT');
    expect(allocation.isOperationalState()).toBe(false);
  });

  it('permits identity edits only while current and draft', () => {
    const allocation = createAllocation();

    allocation.updateDetails(
      {
        ppmpNumber: PpmpNumber.from('PPMP-2026-002'),
        officePublicId: publicId('000000000103'),
        quarter: Quarter.from(3),
        fiscalYear: FiscalYear.from(2027),
      },
      at(1),
    );

    expect(allocation.ppmpNumber.toString()).toBe('PPMP-2026-002');
    expect(allocation.officePublicId.toString()).toBe('01900000-0000-7000-8000-000000000103');
    expect(allocation.quarter.toNumber()).toBe(3);
    expect(allocation.fiscalYear.toNumber()).toBe(2027);
    expect(allocation.updatedAt).toEqual(at(1));

    allocation.activate(at(2));
    expect(() =>
      allocation.updateDetails(
        {
          ppmpNumber: PpmpNumber.from('PPMP-2026-003'),
          officePublicId: publicId('000000000103'),
          quarter: Quarter.from(3),
          fiscalYear: FiscalYear.from(2027),
        },
        at(3),
      ),
    ).toThrow('Only draft budget allocations can be edited.');
  });

  it('enforces the draft, active, and terminal transition graph', () => {
    const active = createAllocation();
    active.activate(at(1));
    expect(active.status.toString()).toBe('ACTIVE');
    expect(active.isOperationalState()).toBe(true);
    active.close(at(2));
    expect(active.status.toString()).toBe('CLOSED');
    expect(active.isOperationalState()).toBe(false);
    expect(() => active.cancel(at(3))).toThrow('Closed budget allocations are terminal.');

    const cancelledDraft = createAllocation();
    cancelledDraft.cancel(at(1));
    expect(cancelledDraft.status.toString()).toBe('CANCELLED');
    expect(() => cancelledDraft.activate(at(2))).toThrow(
      'Cancelled budget allocations are terminal.',
    );

    const draft = createAllocation();
    expect(() => draft.close(at(1))).toThrow('Only active budget allocations can be closed.');
  });

  it.each([
    ['DRAFT', 'DRAFT'],
    ['ACTIVE', 'DRAFT'],
    ['CLOSED', 'CLOSED'],
    ['CANCELLED', 'CANCELLED'],
  ] as const)('restores a deleted %s allocation as %s', (beforeDelete, afterRestore) => {
    const allocation = createAllocation();
    if (beforeDelete === 'ACTIVE' || beforeDelete === 'CLOSED') allocation.activate(at(1));
    if (beforeDelete === 'CLOSED') allocation.close(at(2));
    if (beforeDelete === 'CANCELLED') allocation.cancel(at(1));

    allocation.softDelete({
      at: at(3),
      actorPublicId: publicId('000000000104'),
      reason: 'Superseded allocation record.',
    });

    expect(allocation.isOperationalState()).toBe(false);
    expect(() => allocation.activate(at(4))).toThrow(
      'Deleted budget allocations cannot be changed.',
    );

    allocation.restore(at(5));
    expect(allocation.status.toString()).toBe(afterRestore);
    expect(allocation.deletedAt).toBeNull();
    expect(allocation.deletedByActorPublicId).toBeNull();
    expect(allocation.deleteReason).toBeNull();
    expect(allocation.isOperationalState()).toBe(false);
  });

  it('rejects a second deletion and restoration of a current allocation', () => {
    const allocation = createAllocation();
    allocation.softDelete({
      at: at(1),
      actorPublicId: publicId('000000000104'),
      reason: 'Superseded allocation record.',
    });

    expect(() =>
      allocation.softDelete({
        at: at(2),
        actorPublicId: publicId('000000000104'),
        reason: 'Superseded allocation record.',
      }),
    ).toThrow('Deleted budget allocations cannot be changed.');

    allocation.restore(at(2));
    expect(() => allocation.restore(at(3))).toThrow('Budget allocation is not deleted.');
  });

  it('rejects invalid PPMP, quarter, and fiscal-year values', () => {
    expect(() => PpmpNumber.from('   ')).toThrow('PPMP number must contain 1 to 80 characters.');
    expect(() => PpmpNumber.from('x'.repeat(81))).toThrow(
      'PPMP number must contain 1 to 80 characters.',
    );
    expect(() => Quarter.from(0)).toThrow('Quarter must be an integer from 1 through 4.');
    expect(() => Quarter.from(2.5)).toThrow('Quarter must be an integer from 1 through 4.');
    expect(() => FiscalYear.from(1999)).toThrow(
      'Fiscal year must be an integer from 2000 through 9999.',
    );
    expect(() => FiscalYear.from(10000)).toThrow(
      'Fiscal year must be an integer from 2000 through 9999.',
    );
  });
});
