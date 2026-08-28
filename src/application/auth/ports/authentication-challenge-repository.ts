import type { AuthenticationChallengeType } from '@/application/auth/dto/authentication-dtos';

export interface AuthenticationChallengeRecord {
  readonly publicId: string;
  readonly userPublicId: string;
  readonly tokenHash: Uint8Array;
  readonly csrfTokenHash: Uint8Array;
  readonly type: AuthenticationChallengeType;
  readonly failedAttempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export interface AuthenticationChallengeRepository {
  findByTokenHash(tokenHash: Uint8Array): Promise<AuthenticationChallengeRecord | null>;
  create(challenge: AuthenticationChallengeRecord): Promise<void>;
  incrementFailure(publicId: string): Promise<number>;
  replaceCsrfTokenHash(publicId: string, csrfTokenHash: Uint8Array): Promise<boolean>;
  consume(publicId: string, at: Date): Promise<boolean>;
  revokeForUser(userPublicId: string, at: Date): Promise<number>;
}
