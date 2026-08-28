import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export type BudgetAllocationAuditAction =
  'created' | 'updated' | 'activated' | 'closed' | 'cancelled' | 'deleted' | 'restored';

export interface BudgetAllocationAuditEventDraft {
  readonly publicId: string;
  readonly action: BudgetAllocationAuditAction;
  readonly entityPublicId: string;
  readonly actorPublicId: string;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: Date;
  readonly reasonCode?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: unknown;
}

export function buildBudgetAllocationAuditEvent(
  input: BudgetAllocationAuditEventDraft,
): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: `budget_allocation.${input.action}`,
    entity: { type: 'budget_allocation', publicId: input.entityPublicId },
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reasonCode: input.reasonCode ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  }).toPrimitives();
}

export function budgetAllocationAuditSnapshot(
  allocation: BudgetAllocation,
): Readonly<Record<string, string | number>> {
  return Object.freeze({
    ppmpNumber: allocation.ppmpNumber.toString(),
    officePublicId: allocation.officePublicId.toString(),
    quarter: allocation.quarter.toNumber(),
    fiscalYear: allocation.fiscalYear.toNumber(),
    status: allocation.status.toString(),
  });
}
