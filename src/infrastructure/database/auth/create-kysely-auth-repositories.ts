import type { Kysely } from 'kysely';

import type { AuthRepositories } from '@/application/auth/ports/auth-transaction';
import type { Database } from '@/infrastructure/database/types';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';

import { KyselyAuthenticationChallengeRepository } from './kysely-authentication-challenge-repository';
import { KyselyAuthenticationSettingsRepository } from './kysely-authentication-settings-repository';
import { KyselyPasswordResetRepository } from './kysely-password-reset-repository';
import { KyselyPermissionRepository } from './kysely-permission-repository';
import { KyselyRateLimitRepository } from './kysely-rate-limit-repository';
import { KyselyRoleRepository } from './kysely-role-repository';
import { KyselySessionRepository } from './kysely-session-repository';
import { KyselyTotpFactorRepository } from './kysely-totp-factor-repository';
import { KyselyUserRepository } from './kysely-user-repository';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export function createKyselyAuthRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
): AuthRepositories {
  return Object.freeze({
    users: new KyselyUserRepository(database),
    authenticationSettings: new KyselyAuthenticationSettingsRepository(database),
    roles: new KyselyRoleRepository(database),
    permissions: new KyselyPermissionRepository(database),
    sessions: new KyselySessionRepository(database),
    challenges: new KyselyAuthenticationChallengeRepository(database),
    rateLimits: new KyselyRateLimitRepository(database),
    totpFactors: new KyselyTotpFactorRepository(database),
    passwordResets: new KyselyPasswordResetRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
