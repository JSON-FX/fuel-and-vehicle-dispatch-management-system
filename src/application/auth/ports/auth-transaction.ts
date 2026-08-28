import type { AuthenticationChallengeRepository } from '@/application/auth/ports/authentication-challenge-repository';
import type { AuthenticationSettingsRepository } from '@/application/auth/ports/authentication-settings-repository';
import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { PasswordResetRepository } from '@/application/auth/ports/password-reset-repository';
import type { PermissionRepository } from '@/application/auth/ports/permission-repository';
import type { RateLimitRepository } from '@/application/auth/ports/rate-limit-repository';
import type { RoleRepository } from '@/application/auth/ports/role-repository';
import type { SessionRepository } from '@/application/auth/ports/session-repository';
import type { TotpFactorRepository } from '@/application/auth/ports/totp-factor-repository';
import type { UserRepository } from '@/application/auth/ports/user-repository';

export interface AuthRepositories {
  readonly users: UserRepository;
  readonly authenticationSettings: AuthenticationSettingsRepository;
  readonly roles: RoleRepository;
  readonly permissions: PermissionRepository;
  readonly sessions: SessionRepository;
  readonly challenges: AuthenticationChallengeRepository;
  readonly rateLimits: RateLimitRepository;
  readonly totpFactors: TotpFactorRepository;
  readonly passwordResets: PasswordResetRepository;
  readonly auditEvents: AuditEventPort;
}

export interface AuthTransaction {
  execute<T>(work: (repositories: AuthRepositories) => Promise<T>): Promise<T>;
}
