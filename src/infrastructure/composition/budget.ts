import type { Kysely } from 'kysely';

import type { Clock } from '@/application/auth/ports/clock';
import { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import { CreateBudgetAllocation } from '@/application/budget/use-cases/create-budget-allocation';
import { GetBudgetAllocation } from '@/application/budget/use-cases/get-budget-allocation';
import { ListBudgetAllocations } from '@/application/budget/use-cases/list-budget-allocations';
import { ListOperationalBudgetAllocations } from '@/application/budget/use-cases/list-operational-budget-allocations';
import { RestoreBudgetAllocation } from '@/application/budget/use-cases/restore-budget-allocation';
import { SoftDeleteBudgetAllocation } from '@/application/budget/use-cases/soft-delete-budget-allocation';
import { UpdateBudgetAllocation } from '@/application/budget/use-cases/update-budget-allocation';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import type { FiscalPeriodPolicy } from '@/domain/budget/policies/fiscal-period-policy';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';
import { KyselyBudgetTransaction } from '@/infrastructure/database/budget/kysely-budget-transaction';

export interface BudgetWebComposition {
  readonly budgetPermissions: BudgetPermissionPolicy;
  readonly fiscalPeriodPolicy: FiscalPeriodPolicy;
  readonly createBudgetAllocation: CreateBudgetAllocation;
  readonly getBudgetAllocation: GetBudgetAllocation;
  readonly listBudgetAllocations: ListBudgetAllocations;
  readonly listOperationalBudgetAllocations: ListOperationalBudgetAllocations;
  readonly updateBudgetAllocation: UpdateBudgetAllocation;
  readonly softDeleteBudgetAllocation: SoftDeleteBudgetAllocation;
  readonly restoreBudgetAllocation: RestoreBudgetAllocation;
}

export function createBudgetWebComposition(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
  dependencies: { readonly publicIds: PublicIdGenerator; readonly clock: Clock },
): BudgetWebComposition {
  const transaction = new KyselyBudgetTransaction(database, auditOptions);
  const permissions = new BudgetPermissionPolicy();
  const fiscalPeriodPolicy = new ManilaFiscalPeriodPolicy();
  const common = { transaction, permissions, fiscalPeriodPolicy, ...dependencies } as const;
  return Object.freeze({
    budgetPermissions: permissions,
    fiscalPeriodPolicy,
    createBudgetAllocation: new CreateBudgetAllocation(common),
    getBudgetAllocation: new GetBudgetAllocation(common),
    listBudgetAllocations: new ListBudgetAllocations(common),
    listOperationalBudgetAllocations: new ListOperationalBudgetAllocations(common),
    updateBudgetAllocation: new UpdateBudgetAllocation(common),
    softDeleteBudgetAllocation: new SoftDeleteBudgetAllocation(common),
    restoreBudgetAllocation: new RestoreBudgetAllocation(common),
  });
}
