import type { AuthenticationChallengeRepository } from '@/application/auth/ports/authentication-challenge-repository';
import type { PasswordResetRepository } from '@/application/auth/ports/password-reset-repository';
import type { PermissionRepository } from '@/application/auth/ports/permission-repository';
import type { RateLimitRepository } from '@/application/auth/ports/rate-limit-repository';
import type { RoleRepository } from '@/application/auth/ports/role-repository';
import type { SecurityEventPort } from '@/application/auth/ports/security-event-port';
import type { SessionRepository } from '@/application/auth/ports/session-repository';
import type { TotpFactorRepository } from '@/application/auth/ports/totp-factor-repository';
import type { UserRepository } from '@/application/auth/ports/user-repository';

export interface AuthRepositories {
  readonly users: UserRepository;
  readonly roles: RoleRepository;
  readonly permissions: PermissionRepository;
  readonly sessions: SessionRepository;
  readonly challenges: AuthenticationChallengeRepository;
  readonly rateLimits: RateLimitRepository;
  readonly totpFactors: TotpFactorRepository;
  readonly passwordResets: PasswordResetRepository;
  readonly securityEvents: SecurityEventPort;
}

export interface AuthTransaction {
  execute<T>(work: (repositories: AuthRepositories) => Promise<T>): Promise<T>;
}
