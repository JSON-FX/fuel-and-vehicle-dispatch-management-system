import type { Clock } from '@/application/auth/ports/clock';
import type { MasterDataTransaction } from '@/application/master-data/ports/master-data-transaction';
import type { MasterDataPermissionPolicy } from '@/application/master-data/services/master-data-permission-policy';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface MasterDataUseCaseDependencies {
  readonly transaction: MasterDataTransaction;
  readonly permissions: MasterDataPermissionPolicy;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
}
