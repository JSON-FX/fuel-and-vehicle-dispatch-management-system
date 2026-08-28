export interface SessionRecord {
  readonly publicId: string;
  readonly userPublicId: string;
  readonly tokenHash: Uint8Array;
  readonly csrfTokenHash: Uint8Array;
  readonly isPrivileged: boolean;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokeReason: string | null;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: Uint8Array): Promise<SessionRecord | null>;
  create(session: SessionRecord): Promise<void>;
  countActivePrivileged(userPublicId: string, at: Date): Promise<number>;
  updateActivity(publicId: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<boolean>;
  replaceCsrfTokenHash(publicId: string, csrfTokenHash: Uint8Array): Promise<boolean>;
  revoke(publicId: string, at: Date, reason: string): Promise<boolean>;
  revokeForUser(userPublicId: string, at: Date, reason: string): Promise<number>;
  listForUser(userPublicId: string): Promise<readonly SessionRecord[]>;
}
