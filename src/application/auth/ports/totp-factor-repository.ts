import type { EncryptedSecret } from '@/application/auth/ports/secret-encryptor';

export interface TotpFactorRecord {
  readonly publicId: string;
  readonly userPublicId: string;
  readonly status: 'PENDING' | 'ENABLED' | 'DISABLED';
  readonly encryptedSecret: EncryptedSecret;
  readonly lastUsedCounter: number | null;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TotpFactorRepository {
  findForUser(userPublicId: string): Promise<TotpFactorRecord | null>;
  save(factor: TotpFactorRecord): Promise<void>;
  enable(publicId: string, confirmedAt: Date, counter: number): Promise<boolean>;
  acceptCounter(publicId: string, counter: number, updatedAt: Date): Promise<boolean>;
  disableForUser(userPublicId: string, updatedAt: Date): Promise<boolean>;
}
