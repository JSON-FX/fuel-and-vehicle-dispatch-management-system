import { afterEach, describe, expect, it } from 'vitest';

import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import { createApplicationComposition } from '@/infrastructure/composition/root';
import { destroyDatabaseClients } from '@/infrastructure/database/client';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

const environment = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '1',
  DATABASE_NAME: 'fvdms_test',
  DATABASE_USER: 'fvdms_app',
  DATABASE_PASSWORD: 'application-password',
  DATABASE_POOL_MIN: '0',
  DATABASE_POOL_MAX: '2',
  DATABASE_CONNECT_TIMEOUT_MS: '50',
  DATABASE_QUERY_TIMEOUT_MS: '50',
  AUTH_ALLOWED_ORIGIN: 'https://fvdms.lan',
  AUTH_STANDARD_IDLE_TIMEOUT_SECONDS: '1800',
  AUTH_PRIVILEGED_IDLE_TIMEOUT_SECONDS: '900',
  AUTH_ABSOLUTE_TIMEOUT_SECONDS: '28800',
  AUTH_PRIVILEGED_SESSION_LIMIT: '1',
  AUTH_RATE_LIMIT_MAX_FAILURES: '5',
  AUTH_RATE_LIMIT_WINDOW_SECONDS: '900',
  AUTH_RATE_LIMIT_LOCK_SECONDS: '900',
  AUTH_CHALLENGE_TTL_SECONDS: '300',
  AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS: '300',
  AUTH_PASSWORD_MIN_LENGTH: '12',
  AUTH_PASSWORD_MAX_LENGTH: '128',
  AUTH_TOTP_ACTIVE_KEY_VERSION: '1',
  AUTH_TOTP_ENCRYPTION_KEYS: JSON.stringify({
    1: Buffer.alloc(32, 1).toString('base64'),
  }),
  AUTH_RATE_LIMIT_HMAC_KEY: Buffer.alloc(32, 2).toString('base64'),
};

afterEach(async () => {
  await destroyDatabaseClients();
});

describe('application composition', () => {
  it('constructs immutable application services without opening a connection', () => {
    const composition = createApplicationComposition(environment);

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.getHealthStatus).toBeInstanceOf(GetHealthStatus);
    expect(composition.publicIdGenerator).toBeInstanceOf(UuidV7Generator);
    expect(composition.secureTokenGenerator.generateToken).toBeTypeOf('function');
    expect(composition.authAllowedOrigin).toBe('https://fvdms.lan');
    expect(composition.logger.info).toBeTypeOf('function');
    expect(composition.budgetPermissions.canRead).toBeTypeOf('function');
    expect(composition.dispatchPermissions.canRead).toBeTypeOf('function');
    expect(composition.fiscalPeriodPolicy.resolveCivilDate('2026-08-28')).toEqual({
      fiscalYear: 2026,
      quarter: 3,
    });

    expect(
      [
        composition.login,
        composition.authenticateChallenge,
        composition.authenticateSession,
        composition.authorizePermission,
        composition.recordAuthorizationDenial,
        composition.logout,
        composition.getCurrentPrincipal,
        composition.getCurrentChallenge,
        composition.changePassword,
        composition.startTotpEnrollment,
        composition.confirmTotpEnrollment,
        composition.completeTotpChallenge,
        composition.listUsers,
        composition.getUser,
        composition.createUser,
        composition.updateUser,
        composition.softDeleteUser,
        composition.restoreUser,
        composition.assignUserRoles,
        composition.resetUserPassword,
        composition.resetUserTotp,
        composition.revokeUserSessions,
        composition.listRoles,
        composition.listPermissions,
        composition.createRole,
        composition.updateRole,
        composition.assignRolePermissions,
        composition.searchAuditEvents,
        composition.getAuditEvent,
        composition.getLatestAuditVerification,
        composition.createOffice,
        composition.listOperationalOfficeOptions,
        composition.createDriver,
        composition.listOperationalDriverOptions,
        composition.createVehicle,
        composition.listOperationalVehicleOptions,
        composition.createBudgetAllocation,
        composition.listOperationalBudgetAllocations,
        composition.restoreBudgetAllocation,
        composition.createDispatch,
        composition.getDispatch,
        composition.listDispatches,
        composition.getDispatchPreparationOptions,
        composition.updateDraftDispatch,
        composition.dispatchVehicle,
        composition.completeDispatch,
        composition.cancelDispatch,
        composition.getReport,
        composition.getReportFilterOptions,
        composition.requestReportExport,
        composition.listOwnExportJobs,
        composition.getOwnExportJob,
        composition.issueExportDownloadLink,
        composition.downloadExport,
      ].every((service) => typeof service.execute === 'function'),
    ).toBe(true);
  });
});
