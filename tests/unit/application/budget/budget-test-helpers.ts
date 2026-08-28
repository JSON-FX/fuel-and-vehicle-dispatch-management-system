import { vi } from 'vitest';

import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { BudgetAllocationRepository } from '@/application/budget/ports/budget-allocation-repository';
import type {
  BudgetRepositories,
  BudgetTransaction,
} from '@/application/budget/ports/budget-transaction';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export const publicId = (value: number) =>
  PublicId.from(`01900000-0000-7000-8000-${String(value).padStart(12, '0')}`);

export function principal(permissions: readonly string[]): CurrentPrincipal {
  return {
    userPublicId: publicId(401).toString(),
    username: 'budget.officer',
    fullName: 'Budget Officer',
    roles: ['BUDGET_OFFICER'],
    permissions,
    isPrivileged: false,
    mustChangePassword: false,
    mfaEnrolled: true,
  };
}

export function requestContext(permissions: readonly string[]) {
  return {
    principal: principal(permissions),
    requestId: 'request-fvd-005',
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest',
  } as const;
}

export function createBudgetTestDependencies(): {
  readonly dependencies: BudgetUseCaseDependencies;
  readonly repositories: BudgetRepositories;
} {
  let nextId = 410;
  const allocations: BudgetAllocationRepository = {
    findCurrentByPublicId: vi.fn().mockResolvedValue(null),
    findIncludingDeletedByPublicId: vi.fn().mockResolvedValue(null),
    findCurrentByPublicIdForUpdate: vi.fn().mockResolvedValue(null),
    findDeletedByPublicIdForUpdate: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(undefined),
    updateDetails: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    listAdmin: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    }),
    listOperational: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    }),
  };
  const offices: OfficeRepository = {
    findCurrentByPublicId: vi.fn().mockResolvedValue(null),
    findIncludingDeletedByPublicId: vi.fn().mockResolvedValue(null),
    findCurrentByPublicIdForUpdate: vi.fn().mockResolvedValue(null),
    findDeletedByPublicIdForUpdate: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(undefined),
    updateDetails: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    listAdmin: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    }),
    listOperational: vi.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    }),
  };
  const auditEvents: AuditEventPort = { append: vi.fn().mockResolvedValue(undefined) };
  const repositories = { allocations, offices, auditEvents } as const;
  const transaction: BudgetTransaction = {
    execute: vi.fn(async (work) => work(repositories)),
  };
  return {
    repositories,
    dependencies: {
      transaction,
      permissions: new BudgetPermissionPolicy(),
      publicIds: { generate: () => publicId(nextId++) },
      clock: { now: () => new Date('2026-08-28T10:00:00.000Z') },
      fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
    },
  };
}
