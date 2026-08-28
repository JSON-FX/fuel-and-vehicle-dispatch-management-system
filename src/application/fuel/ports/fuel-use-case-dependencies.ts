import type { Clock } from '@/application/auth/ports/clock';
import type { FuelTransaction } from '@/application/fuel/ports/fuel-transaction';
import type { FuelPermissionPolicy } from '@/application/fuel/services/fuel-permission-policy';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import type { FiscalPeriodPolicy } from '@/domain/budget/policies/fiscal-period-policy';

export interface FuelUseCaseDependencies {
  readonly transaction: FuelTransaction;
  readonly permissions: FuelPermissionPolicy;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
  readonly fiscalPeriodPolicy: FiscalPeriodPolicy;
}
