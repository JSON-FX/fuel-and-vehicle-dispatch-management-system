import type { Kysely } from 'kysely';

import type { AuthRepositories } from '@/application/auth/ports/auth-transaction';
import type { Database } from '@/infrastructure/database/types';

import { KyselyAuthenticationChallengeRepository } from './kysely-authentication-challenge-repository';
import { KyselyPasswordResetRepository } from './kysely-password-reset-repository';
import { KyselyPermissionRepository } from './kysely-permission-repository';
import { KyselyRateLimitRepository } from './kysely-rate-limit-repository';
import { KyselyRoleRepository } from './kysely-role-repository';
import { KyselySecurityEventStore } from './kysely-security-event-store';
import { KyselySessionRepository } from './kysely-session-repository';
import { KyselyTotpFactorRepository } from './kysely-totp-factor-repository';
import { KyselyUserRepository } from './kysely-user-repository';

export function createKyselyAuthRepositories(database: Kysely<Database>): AuthRepositories {
  return Object.freeze({
    users: new KyselyUserRepository(database),
    roles: new KyselyRoleRepository(database),
    permissions: new KyselyPermissionRepository(database),
    sessions: new KyselySessionRepository(database),
    challenges: new KyselyAuthenticationChallengeRepository(database),
    rateLimits: new KyselyRateLimitRepository(database),
    totpFactors: new KyselyTotpFactorRepository(database),
    passwordResets: new KyselyPasswordResetRepository(database),
    securityEvents: new KyselySecurityEventStore(database),
  });
}
