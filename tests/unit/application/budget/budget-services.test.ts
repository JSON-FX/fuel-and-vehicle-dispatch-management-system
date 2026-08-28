import { describe, expect, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import {
  budgetAllocationAuditSnapshot,
  buildBudgetAllocationAuditEvent,
} from '@/application/budget/services/budget-allocation-audit-events';
import { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);

function principal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: publicId('000000000201').toString(),
    username: 'budget.officer',
    fullName: 'Budget Officer',
    roles: ['BUDGET_OFFICER'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: true,
  };
}

function allocation(): BudgetAllocation {
  return new BudgetAllocation({
    publicId: publicId('000000000202'),
    ppmpNumber: PpmpNumber.from('PPMP-2026-01'),
    officePublicId: publicId('000000000203'),
    quarter: Quarter.from(3),
    fiscalYear: FiscalYear.from(2026),
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
  });
}

describe('budget application services', () => {
  it('lets budget.manage imply read without granting management to readers', () => {
    const policy = new BudgetPermissionPolicy();
    const manager = principal(['budget.manage']);
    const reader = principal(['budget.read']);
    const unrelated = principal(['office.read']);

    expect(policy.canRead(manager)).toBe(true);
    expect(policy.canManage(manager)).toBe(true);
    expect(policy.canRead(reader)).toBe(true);
    expect(policy.canManage(reader)).toBe(false);
    expect(policy.canRead(unrelated)).toBe(false);
    expect(() => policy.assertCanRead(unrelated)).toThrow('not allowed');
    expect(() => policy.assertCanManage(reader)).toThrow('not allowed');
  });

  it('creates an allowlisted allocation snapshot without deletion evidence or internal IDs', () => {
    const snapshot = budgetAllocationAuditSnapshot(allocation());

    expect(snapshot).toEqual({
      ppmpNumber: 'PPMP-2026-01',
      officePublicId: '01900000-0000-7000-8000-000000000203',
      quarter: 3,
      fiscalYear: 2026,
      status: 'DRAFT',
    });
    expect(snapshot).not.toHaveProperty('id');
    expect(snapshot).not.toHaveProperty('deleteReason');
  });

  it.each([
    'created',
    'updated',
    'activated',
    'closed',
    'cancelled',
    'deleted',
    'restored',
  ] as const)('builds a valid budget_allocation.%s audit event', (action) => {
    const target = allocation();
    const event = buildBudgetAllocationAuditEvent({
      publicId: publicId('000000000204').toString(),
      action,
      entityPublicId: target.publicId.toString(),
      actorPublicId: principal([]).userPublicId,
      requestId: 'request-fvd-005',
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
      occurredAt: new Date('2026-08-28T01:00:00.000Z'),
      after: budgetAllocationAuditSnapshot(target),
    });

    expect(event.action).toBe(`budget_allocation.${action}`);
    expect(event.entity).toEqual({
      type: 'budget_allocation',
      publicId: target.publicId.toString(),
    });
    expect(event.reasonCode).toBeNull();
  });
});
