import type { Kysely } from 'kysely';

import type { Clock } from '@/application/auth/ports/clock';
import { FuelPermissionPolicy } from '@/application/fuel/services/fuel-permission-policy';
import { CreateFuelIssuance } from '@/application/fuel/use-cases/create-fuel-issuance';
import { GetFuelBalances } from '@/application/fuel/use-cases/get-fuel-balances';
import { GetFuelIssuance } from '@/application/fuel/use-cases/get-fuel-issuance';
import { GetFuelPreparationOptions } from '@/application/fuel/use-cases/get-fuel-preparation-options';
import { ListFuelIssuances } from '@/application/fuel/use-cases/list-fuel-issuances';
import { PostFuelIssuance } from '@/application/fuel/use-cases/post-fuel-issuance';
import { UpdateDraftFuelIssuance } from '@/application/fuel/use-cases/update-draft-fuel-issuance';
import { VoidFuelIssuance } from '@/application/fuel/use-cases/void-fuel-issuance';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyFuelTransaction } from '@/infrastructure/database/fuel/kysely-fuel-transaction';
import type { Database } from '@/infrastructure/database/types';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';

export interface FuelWebComposition {
  readonly fuelPermissions: FuelPermissionPolicy;
  readonly createFuelIssuance: CreateFuelIssuance;
  readonly updateDraftFuelIssuance: UpdateDraftFuelIssuance;
  readonly getFuelIssuance: GetFuelIssuance;
  readonly getFuelPreparationOptions: GetFuelPreparationOptions;
  readonly listFuelIssuances: ListFuelIssuances;
  readonly postFuelIssuance: PostFuelIssuance;
  readonly voidFuelIssuance: VoidFuelIssuance;
  readonly getFuelBalances: GetFuelBalances;
}

export function createFuelWebComposition(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
  dependencies: { readonly publicIds: PublicIdGenerator; readonly clock: Clock },
): FuelWebComposition {
  const transaction = new KyselyFuelTransaction(database, auditOptions);
  const permissions = new FuelPermissionPolicy();
  const common = {
    transaction,
    permissions,
    fiscalPeriodPolicy: new ManilaFiscalPeriodPolicy(),
    ...dependencies,
  } as const;
  return Object.freeze({
    fuelPermissions: permissions,
    createFuelIssuance: new CreateFuelIssuance(common),
    updateDraftFuelIssuance: new UpdateDraftFuelIssuance(common),
    getFuelIssuance: new GetFuelIssuance(common),
    getFuelPreparationOptions: new GetFuelPreparationOptions(common),
    listFuelIssuances: new ListFuelIssuances(common),
    postFuelIssuance: new PostFuelIssuance(common),
    voidFuelIssuance: new VoidFuelIssuance(common),
    getFuelBalances: new GetFuelBalances(common),
  });
}
