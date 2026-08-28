import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';

export type TotpFactorStatus = 'PENDING' | 'ENABLED' | 'DISABLED';

export interface TotpFactorProperties {
  readonly publicId: PublicId;
  readonly status: TotpFactorStatus;
  readonly confirmedAt: Date | null;
  readonly lastUsedCounter: number | null;
}

export class TotpFactor {
  readonly publicId: PublicId;
  status: TotpFactorStatus;
  confirmedAt: Date | null;
  lastUsedCounter: number | null;

  constructor(properties: TotpFactorProperties) {
    this.publicId = properties.publicId;
    this.status = properties.status;
    this.confirmedAt = properties.confirmedAt;
    this.lastUsedCounter = properties.lastUsedCounter;
  }

  enable(at: Date): void {
    if (this.status !== 'PENDING') {
      throw new DomainError('INVALID_TOTP_STATE', 'Only a pending TOTP factor can be enabled.');
    }
    this.status = 'ENABLED';
    this.confirmedAt = at;
  }

  acceptCounter(counter: number): void {
    if (this.status !== 'ENABLED') {
      throw new DomainError('INVALID_TOTP_STATE', 'The TOTP factor is not enabled.');
    }
    if (this.lastUsedCounter !== null && counter <= this.lastUsedCounter) {
      throw new DomainError('TOTP_REPLAYED', 'The one-time code has already been used.');
    }
    this.lastUsedCounter = counter;
  }
}
