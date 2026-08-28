import type { Clock } from '@/application/auth/ports/clock';
import type { DispatchConflictFingerprintPort } from '@/application/dispatch/ports/dispatch-conflict-fingerprint-port';
import type { DispatchTransaction } from '@/application/dispatch/ports/dispatch-transaction';
import type { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface DispatchUseCaseDependencies {
  readonly transaction: DispatchTransaction;
  readonly permissions: DispatchPermissionPolicy;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
  readonly conflictFingerprints: DispatchConflictFingerprintPort;
}
