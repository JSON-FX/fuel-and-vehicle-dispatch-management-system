import type { PublicId } from '@/domain/shared/value-objects/public-id';

export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'IDLE_EXPIRED' | 'ABSOLUTE_EXPIRED';

export interface SessionProperties {
  readonly publicId: PublicId;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
  readonly revokeReason: string | null;
  readonly isPrivileged: boolean;
}

export class Session {
  readonly publicId: PublicId;
  readonly createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  readonly isPrivileged: boolean;

  constructor(properties: SessionProperties) {
    this.publicId = properties.publicId;
    this.createdAt = properties.createdAt;
    this.lastSeenAt = properties.lastSeenAt;
    this.idleExpiresAt = properties.idleExpiresAt;
    this.absoluteExpiresAt = properties.absoluteExpiresAt;
    this.revokedAt = properties.revokedAt;
    this.revokeReason = properties.revokeReason;
    this.isPrivileged = properties.isPrivileged;
  }

  statusAt(now: Date): SessionStatus {
    if (this.revokedAt !== null) return 'REVOKED';
    if (now >= this.absoluteExpiresAt) return 'ABSOLUTE_EXPIRED';
    if (now >= this.idleExpiresAt) return 'IDLE_EXPIRED';
    return 'ACTIVE';
  }

  needsActivityUpdate(now: Date, intervalSeconds: number): boolean {
    return now.getTime() - this.lastSeenAt.getTime() >= intervalSeconds * 1_000;
  }

  recordActivity(now: Date, idleTimeoutSeconds: number): void {
    this.lastSeenAt = now;
    const candidate = new Date(now.getTime() + idleTimeoutSeconds * 1_000);
    this.idleExpiresAt = candidate < this.absoluteExpiresAt ? candidate : this.absoluteExpiresAt;
  }

  revoke(at: Date, reason: string): void {
    if (this.revokedAt !== null) return;
    this.revokedAt = at;
    this.revokeReason = reason;
  }
}
