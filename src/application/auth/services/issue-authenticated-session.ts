import type { LoginResult } from '@/application/auth/dto/authentication-dtos';
import { createCurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthRepositories } from '@/application/auth/ports/auth-transaction';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { UserAuthenticationRecord } from '@/application/auth/ports/user-repository';
import { ConflictError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export async function issueAuthenticatedSession(input: {
  readonly repositories: AuthRepositories;
  readonly user: UserAuthenticationRecord;
  readonly tokenGenerator: SecureTokenGenerator;
  readonly publicIds: PublicIdGenerator;
  readonly now: Date;
  readonly standardIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly absoluteTimeoutSeconds: number;
  readonly privilegedSessionLimit: number;
}): Promise<LoginResult> {
  if (input.user.isPrivileged) {
    const count = await input.repositories.sessions.countActivePrivileged(
      input.user.publicId,
      input.now,
    );
    if (count >= input.privilegedSessionLimit) {
      throw new ConflictError('A privileged session is already active.');
    }
  }

  const bearerToken = input.tokenGenerator.generateToken();
  const csrfToken = input.tokenGenerator.generateToken();
  const absoluteExpiresAt = addSeconds(input.now, input.absoluteTimeoutSeconds);
  const idleTimeout = input.user.isPrivileged
    ? input.privilegedIdleTimeoutSeconds
    : input.standardIdleTimeoutSeconds;
  await input.repositories.sessions.create({
    publicId: input.publicIds.generate().toString(),
    userPublicId: input.user.publicId,
    tokenHash: input.tokenGenerator.hashToken(bearerToken),
    csrfTokenHash: input.tokenGenerator.hashToken(csrfToken),
    isPrivileged: input.user.isPrivileged,
    createdAt: input.now,
    lastSeenAt: input.now,
    idleExpiresAt: addSeconds(input.now, idleTimeout),
    absoluteExpiresAt,
    revokedAt: null,
    revokeReason: null,
  });

  return {
    next: 'AUTHENTICATED',
    credential: { bearerToken, csrfToken, expiresAt: absoluteExpiresAt },
    principal: createCurrentPrincipal({
      userPublicId: input.user.publicId,
      username: input.user.username,
      fullName: input.user.fullName,
      roles: input.user.roles,
      permissions: input.user.permissions,
      isPrivileged: input.user.isPrivileged,
      mustChangePassword: input.user.mustChangePassword,
      mfaEnrolled: input.user.mfaEnrolled,
    }),
  };
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}
