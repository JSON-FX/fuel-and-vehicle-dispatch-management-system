import type { Clock } from '@/application/auth/ports/clock';
import type { BudgetTransaction } from './budget-transaction';
import type { BudgetPermissionPolicy } from '@/application/budget/services/budget-permission-policy';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import type { FiscalPeriodPolicy } from '@/domain/budget/policies/fiscal-period-policy';

export interface BudgetUseCaseDependencies {
  readonly transaction: BudgetTransaction;
  readonly permissions: BudgetPermissionPolicy;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
  readonly fiscalPeriodPolicy: FiscalPeriodPolicy;
}
