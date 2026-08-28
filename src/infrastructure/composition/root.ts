import type { Clock } from '@/application/auth/ports/clock';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { AuthenticateChallenge } from '@/application/auth/services/authenticate-challenge';
import { AuthenticateSession } from '@/application/auth/services/authenticate-session';
import { AuthorizePermission } from '@/application/auth/services/authorize-permission';
import { AssignRolePermissions } from '@/application/auth/use-cases/assign-role-permissions';
import { AssignUserRoles } from '@/application/auth/use-cases/assign-user-roles';
import { ChangePassword } from '@/application/auth/use-cases/change-password';
import { CompleteTotpChallenge } from '@/application/auth/use-cases/complete-totp-challenge';
import { ConfirmTotpEnrollment } from '@/application/auth/use-cases/confirm-totp-enrollment';
import { CreateRole } from '@/application/auth/use-cases/create-role';
import { CreateInitialSuperAdmin } from '@/application/auth/use-cases/create-initial-super-admin';
import { CreateUser } from '@/application/auth/use-cases/create-user';
import { GetCurrentPrincipal } from '@/application/auth/use-cases/get-current-principal';
import { GetCurrentChallenge } from '@/application/auth/use-cases/get-current-challenge';
import { GetUser } from '@/application/auth/use-cases/get-user';
import { GetRole } from '@/application/auth/use-cases/get-role';
import { ListRoles } from '@/application/auth/use-cases/list-roles';
import { ListPermissions } from '@/application/auth/use-cases/list-permissions';
import { ListUsers } from '@/application/auth/use-cases/list-users';
import { Login } from '@/application/auth/use-cases/login';
import { Logout } from '@/application/auth/use-cases/logout';
import { ResetUserPassword } from '@/application/auth/use-cases/reset-user-password';
import { ResetUserTotp } from '@/application/auth/use-cases/reset-user-totp';
import { RestoreUser } from '@/application/auth/use-cases/restore-user';
import { RevokeUserSessions } from '@/application/auth/use-cases/revoke-user-sessions';
import { SoftDeleteUser } from '@/application/auth/use-cases/soft-delete-user';
import { StartTotpEnrollment } from '@/application/auth/use-cases/start-totp-enrollment';
import { UpdateRole } from '@/application/auth/use-cases/update-role';
import { UpdateUser } from '@/application/auth/use-cases/update-user';
import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PasswordPolicy } from '@/domain/user/value-objects/password-policy';
import { AesGcmSecretEncryptor } from '@/infrastructure/auth/aes-gcm-secret-encryptor';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { HmacRateLimitKey } from '@/infrastructure/auth/hmac-rate-limit-key';
import { NodeSecureTokenGenerator } from '@/infrastructure/auth/node-secure-token-generator';
import { OtpAuthTotpService } from '@/infrastructure/auth/otpauth-totp-service';
import { QrCodeSvgGenerator } from '@/infrastructure/auth/qrcode-generator';
import { parseRuntimeEnvironment } from '@/infrastructure/config/environment';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { getRuntimeDatabase } from '@/infrastructure/database/client';
import { KyselyHealthCheckRepository } from '@/infrastructure/database/health/kysely-health-check-repository';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$s2r5DIVnB+eVyeEK/iQvPQ$t/XFGhEWgUdX+otDbdK8TKnVKv/0KQMpzSQq5DEahaU';

export interface ApplicationComposition {
  readonly getHealthStatus: GetHealthStatus;
  readonly logger: Logger;
  readonly publicIdGenerator: PublicIdGenerator;
  readonly secureTokenGenerator: SecureTokenGenerator;
  readonly authAllowedOrigin: string;
  readonly login: Login;
  readonly authenticateChallenge: AuthenticateChallenge;
  readonly authenticateSession: AuthenticateSession;
  readonly authorizePermission: AuthorizePermission;
  readonly logout: Logout;
  readonly getCurrentPrincipal: GetCurrentPrincipal;
  readonly getCurrentChallenge: GetCurrentChallenge;
  readonly changePassword: ChangePassword;
  readonly startTotpEnrollment: StartTotpEnrollment;
  readonly confirmTotpEnrollment: ConfirmTotpEnrollment;
  readonly completeTotpChallenge: CompleteTotpChallenge;
  readonly listUsers: ListUsers;
  readonly getUser: GetUser;
  readonly getRole: GetRole;
  readonly createUser: CreateUser;
  readonly createInitialSuperAdmin: CreateInitialSuperAdmin;
  readonly updateUser: UpdateUser;
  readonly softDeleteUser: SoftDeleteUser;
  readonly restoreUser: RestoreUser;
  readonly assignUserRoles: AssignUserRoles;
  readonly resetUserPassword: ResetUserPassword;
  readonly resetUserTotp: ResetUserTotp;
  readonly revokeUserSessions: RevokeUserSessions;
  readonly listRoles: ListRoles;
  readonly listPermissions: ListPermissions;
  readonly createRole: CreateRole;
  readonly updateRole: UpdateRole;
  readonly assignRolePermissions: AssignRolePermissions;
}

let singletonComposition: ApplicationComposition | undefined;

export function createApplicationComposition(
  environment?: Record<string, string | undefined>,
): ApplicationComposition {
  if (environment === undefined) {
    singletonComposition ??= buildApplicationComposition(process.env);
    return singletonComposition;
  }
  return buildApplicationComposition(environment);
}

function buildApplicationComposition(
  environment: Record<string, string | undefined>,
): ApplicationComposition {
  const configuration = parseRuntimeEnvironment(environment);
  const database = getRuntimeDatabase(environment);
  const repositories = createKyselyAuthRepositories(database);
  const transaction = new KyselyAuthTransaction(database);
  const publicIds = new UuidV7Generator();
  const clock: Clock = Object.freeze({ now: () => new Date() });
  const passwordHasher = new Argon2PasswordHasher();
  const tokenGenerator = new NodeSecureTokenGenerator();
  const rateLimitKeys = new HmacRateLimitKey(configuration.auth.rateLimitHmacKey);
  const totp = new OtpAuthTotpService();
  const encryptor = new AesGcmSecretEncryptor(
    configuration.auth.totpEncryptionKeys,
    configuration.auth.totpActiveKeyVersion,
  );
  const common = { transaction, publicIds, clock } as const;
  const sessionPolicy = {
    standardIdleTimeoutSeconds: configuration.auth.standardIdleTimeoutSeconds,
    privilegedIdleTimeoutSeconds: configuration.auth.privilegedIdleTimeoutSeconds,
    absoluteTimeoutSeconds: configuration.auth.absoluteTimeoutSeconds,
    privilegedSessionLimit: configuration.auth.privilegedSessionLimit,
  } as const;
  const authenticateSession = new AuthenticateSession({
    transaction,
    tokenGenerator,
    clock,
    policy: {
      activityWriteIntervalSeconds: configuration.auth.activityWriteIntervalSeconds,
      standardIdleTimeoutSeconds: configuration.auth.standardIdleTimeoutSeconds,
      privilegedIdleTimeoutSeconds: configuration.auth.privilegedIdleTimeoutSeconds,
    },
  });
  const authenticateChallenge = new AuthenticateChallenge({ transaction, tokenGenerator, clock });

  return Object.freeze({
    getHealthStatus: new GetHealthStatus(
      new KyselyHealthCheckRepository(database, configuration.database.queryTimeoutMs),
    ),
    logger: createPinoLogger({ level: configuration.logLevel }),
    publicIdGenerator: publicIds,
    secureTokenGenerator: tokenGenerator,
    authAllowedOrigin: configuration.auth.allowedOrigin,
    login: new Login({
      transaction,
      passwordHasher,
      tokenGenerator,
      rateLimitKeys,
      publicIds,
      clock,
      dummyPasswordHash: DUMMY_PASSWORD_HASH,
      policy: {
        ...sessionPolicy,
        challengeTtlSeconds: configuration.auth.challengeTtlSeconds,
        rateLimitWindowSeconds: configuration.auth.rateLimitWindowSeconds,
        rateLimitLockSeconds: configuration.auth.rateLimitLockSeconds,
        rateLimitMaxFailures: configuration.auth.rateLimitMaxFailures,
      },
    }),
    authenticateChallenge,
    authenticateSession,
    authorizePermission: new AuthorizePermission(),
    logout: new Logout({ transaction, tokenGenerator, publicIds, clock }),
    getCurrentPrincipal: new GetCurrentPrincipal({
      authenticateSession,
      transaction,
      tokenGenerator,
    }),
    getCurrentChallenge: new GetCurrentChallenge({
      authenticateChallenge,
      transaction,
      tokenGenerator,
    }),
    changePassword: new ChangePassword({
      ...common,
      passwordHasher,
      passwordPolicy: new PasswordPolicy(
        configuration.auth.passwordMinLength,
        configuration.auth.passwordMaxLength,
      ),
    }),
    startTotpEnrollment: new StartTotpEnrollment({
      ...common,
      totp,
      encryptor,
      qrCode: new QrCodeSvgGenerator(),
      issuer: 'Fuel and Vehicle Dispatch Management System',
    }),
    confirmTotpEnrollment: new ConfirmTotpEnrollment({
      ...common,
      totp,
      encryptor,
      tokenGenerator,
      rateLimitKeys,
      sessionPolicy,
      rateLimitPolicy: {
        windowSeconds: configuration.auth.rateLimitWindowSeconds,
        lockSeconds: configuration.auth.rateLimitLockSeconds,
        maximumFailures: configuration.auth.rateLimitMaxFailures,
      },
    }),
    completeTotpChallenge: new CompleteTotpChallenge({
      transaction,
      totp,
      encryptor,
      clock,
      tokenGenerator,
      rateLimitKeys,
      publicIds,
      policy: {
        ...sessionPolicy,
        rateLimitWindowSeconds: configuration.auth.rateLimitWindowSeconds,
        rateLimitLockSeconds: configuration.auth.rateLimitLockSeconds,
        rateLimitMaxFailures: configuration.auth.rateLimitMaxFailures,
      },
    }),
    listUsers: new ListUsers(repositories.users),
    getUser: new GetUser(repositories.users),
    getRole: new GetRole(repositories.roles),
    createUser: new CreateUser({ ...common, passwordHasher, tokenGenerator }),
    createInitialSuperAdmin: new CreateInitialSuperAdmin({
      ...common,
      passwordHasher,
      tokenGenerator,
    }),
    updateUser: new UpdateUser(common),
    softDeleteUser: new SoftDeleteUser(common),
    restoreUser: new RestoreUser(common),
    assignUserRoles: new AssignUserRoles(common),
    resetUserPassword: new ResetUserPassword({ ...common, passwordHasher, tokenGenerator }),
    resetUserTotp: new ResetUserTotp(common),
    revokeUserSessions: new RevokeUserSessions(common),
    listRoles: new ListRoles(repositories.roles),
    listPermissions: new ListPermissions(repositories.permissions),
    createRole: new CreateRole(common),
    updateRole: new UpdateRole(common),
    assignRolePermissions: new AssignRolePermissions(common),
  });
}
