import type {
  CurrentPrincipal,
  LoginCommand,
  LoginResult,
} from '@/application/auth/dto/authentication-dtos';
import { createCurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { PasswordHasher } from '@/application/auth/ports/password-hasher';
import type { RateLimitKeyGenerator } from '@/application/auth/ports/rate-limit-repository';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { UserAuthenticationRecord } from '@/application/auth/ports/user-repository';
import {
  InvalidCredentialsError,
  RateLimitedError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { Username } from '@/domain/user/value-objects/username';

export interface LoginPolicy {
  readonly standardIdleTimeoutSeconds: number;
  readonly privilegedIdleTimeoutSeconds: number;
  readonly absoluteTimeoutSeconds: number;
  readonly challengeTtlSeconds: number;
  readonly rateLimitWindowSeconds: number;
  readonly rateLimitLockSeconds: number;
  readonly rateLimitMaxFailures: number;
}

export interface LoginDependencies {
  readonly transaction: AuthTransaction;
  readonly passwordHasher: PasswordHasher;
  readonly tokenGenerator: SecureTokenGenerator;
  readonly rateLimitKeys: RateLimitKeyGenerator;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
  readonly dummyPasswordHash: string;
  readonly policy: LoginPolicy;
}

export class Login {
  constructor(private readonly dependencies: LoginDependencies) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const now = this.dependencies.clock.now();
    const normalizedUsername = normalizeUsername(command.username);
    const accountKey = this.dependencies.rateLimitKeys.forAccount(normalizedUsername);
    const sourceKey = this.dependencies.rateLimitKeys.forSource(command.sourceAddress);
    const initial = await this.dependencies.transaction.execute(async (repositories) => ({
      user: await repositories.users.findForAuthentication(normalizedUsername),
      accountRate: await repositories.rateLimits.find('ACCOUNT', accountKey),
      sourceRate: await repositories.rateLimits.find('SOURCE', sourceKey),
    }));
    const locked = [initial.accountRate, initial.sourceRate].some(
      (rate) =>
        rate?.lockedUntil !== null && rate?.lockedUntil !== undefined && rate.lockedUntil > now,
    );
    const passwordMatches = await this.dependencies.passwordHasher.verify(
      initial.user?.passwordHash ?? this.dependencies.dummyPasswordHash,
      command.password,
    );
    const eligible =
      initial.user !== null &&
      passwordMatches &&
      initial.user.isActive &&
      initial.user.deletedAt === null &&
      !locked;

    if (!eligible) {
      const reachedLimit = await this.recordFailure(
        accountKey,
        sourceKey,
        now,
        command.requestId,
        initial.user?.publicId ?? null,
      );
      if (locked || reachedLimit) throw new RateLimitedError();
      throw new InvalidCredentialsError();
    }

    const replacementHash = this.dependencies.passwordHasher.needsRehash(initial.user!.passwordHash)
      ? await this.dependencies.passwordHasher.hash(command.password)
      : null;

    return this.dependencies.transaction.execute(async (repositories) => {
      const user = await repositories.users.findByPublicId(initial.user!.publicId);
      if (user === null || !user.isActive || user.deletedAt !== null) {
        throw new InvalidCredentialsError();
      }
      await repositories.rateLimits.clear('ACCOUNT', accountKey);
      if (replacementHash !== null) {
        await repositories.users.updatePassword({
          publicId: user.publicId,
          passwordHash: replacementHash,
          mustChangePassword: user.mustChangePassword,
          updatedAt: now,
        });
      }

      if (user.mustChangePassword) {
        const result = await this.issueChallenge(
          user,
          'PASSWORD_CHANGE',
          now,
          repositories.challenges.create.bind(repositories.challenges),
        );
        await this.appendEvent(
          repositories,
          'auth.login.challenge',
          user.publicId,
          command.requestId,
          now,
          { next: result.next },
        );
        return result;
      }
      if (user.isPrivileged && !user.mfaEnrolled) {
        const result = await this.issueChallenge(
          user,
          'TOTP_ENROLLMENT',
          now,
          repositories.challenges.create.bind(repositories.challenges),
        );
        await this.appendEvent(
          repositories,
          'auth.login.challenge',
          user.publicId,
          command.requestId,
          now,
          { next: result.next },
        );
        return result;
      }
      if (user.isPrivileged) {
        const result = await this.issueChallenge(
          user,
          'TOTP_VERIFICATION',
          now,
          repositories.challenges.create.bind(repositories.challenges),
        );
        await this.appendEvent(
          repositories,
          'auth.login.challenge',
          user.publicId,
          command.requestId,
          now,
          { next: result.next },
        );
        return result;
      }

      const bearerToken = this.dependencies.tokenGenerator.generateToken();
      const csrfToken = this.dependencies.tokenGenerator.generateToken();
      const absoluteExpiresAt = addSeconds(now, this.dependencies.policy.absoluteTimeoutSeconds);
      await repositories.sessions.create({
        publicId: this.dependencies.publicIds.generate().toString(),
        userPublicId: user.publicId,
        tokenHash: this.dependencies.tokenGenerator.hashToken(bearerToken),
        csrfTokenHash: this.dependencies.tokenGenerator.hashToken(csrfToken),
        isPrivileged: false,
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: addSeconds(now, this.dependencies.policy.standardIdleTimeoutSeconds),
        absoluteExpiresAt,
        revokedAt: null,
        revokeReason: null,
      });
      await this.appendEvent(
        repositories,
        'auth.login.succeeded',
        user.publicId,
        command.requestId,
        now,
        { privileged: false },
      );

      return {
        next: 'AUTHENTICATED',
        credential: { bearerToken, csrfToken, expiresAt: absoluteExpiresAt },
        principal: principalFrom(user),
      };
    });
  }

  private async recordFailure(
    accountKey: Uint8Array,
    sourceKey: Uint8Array,
    now: Date,
    requestId: string,
    targetPublicId: string | null,
  ): Promise<boolean> {
    return this.dependencies.transaction.execute(async ({ rateLimits, securityEvents }) => {
      const policy = this.dependencies.policy;
      const account = await rateLimits.recordFailure({
        bucketType: 'ACCOUNT',
        bucketKey: accountKey,
        now,
        windowSeconds: policy.rateLimitWindowSeconds,
        lockSeconds: policy.rateLimitLockSeconds,
        maximumFailures: policy.rateLimitMaxFailures,
      });
      const source = await rateLimits.recordFailure({
        bucketType: 'SOURCE',
        bucketKey: sourceKey,
        now,
        windowSeconds: policy.rateLimitWindowSeconds,
        lockSeconds: policy.rateLimitLockSeconds,
        maximumFailures: policy.rateLimitMaxFailures,
      });
      await securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.login.failed',
        actorPublicId: null,
        targetPublicId,
        requestId,
        reasonCode: 'invalid_credentials',
        metadata: {},
        occurredAt: now,
      });
      return account.lockedUntil !== null || source.lockedUntil !== null;
    });
  }

  private appendEvent(
    repositories: AuthRepositories,
    type: string,
    userPublicId: string,
    requestId: string,
    occurredAt: Date,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return repositories.securityEvents.append({
      publicId: this.dependencies.publicIds.generate().toString(),
      type,
      actorPublicId: userPublicId,
      targetPublicId: userPublicId,
      requestId,
      reasonCode: null,
      metadata,
      occurredAt,
    });
  }

  private async issueChallenge(
    user: UserAuthenticationRecord,
    type: 'PASSWORD_CHANGE' | 'TOTP_ENROLLMENT' | 'TOTP_VERIFICATION',
    now: Date,
    create: (challenge: {
      readonly publicId: string;
      readonly userPublicId: string;
      readonly tokenHash: Uint8Array;
      readonly csrfTokenHash: Uint8Array;
      readonly type: typeof type;
      readonly failedAttempts: number;
      readonly expiresAt: Date;
      readonly consumedAt: Date | null;
      readonly createdAt: Date;
    }) => Promise<void>,
  ): Promise<LoginResult> {
    const bearerToken = this.dependencies.tokenGenerator.generateToken();
    const csrfToken = this.dependencies.tokenGenerator.generateToken();
    const expiresAt = addSeconds(now, this.dependencies.policy.challengeTtlSeconds);
    await create({
      publicId: this.dependencies.publicIds.generate().toString(),
      userPublicId: user.publicId,
      tokenHash: this.dependencies.tokenGenerator.hashToken(bearerToken),
      csrfTokenHash: this.dependencies.tokenGenerator.hashToken(csrfToken),
      type,
      failedAttempts: 0,
      expiresAt,
      consumedAt: null,
      createdAt: now,
    });
    return { next: type, credential: { bearerToken, csrfToken, expiresAt } };
  }
}

function normalizeUsername(value: string): string {
  try {
    return Username.from(value).toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1_000);
}

function principalFrom(user: UserAuthenticationRecord): CurrentPrincipal {
  return createCurrentPrincipal({
    userPublicId: user.publicId,
    username: user.username,
    fullName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    isPrivileged: user.isPrivileged,
    mustChangePassword: user.mustChangePassword,
    mfaEnrolled: user.mfaEnrolled,
  });
}
