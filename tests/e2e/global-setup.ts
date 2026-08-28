import { spawn, type ChildProcess } from 'node:child_process';

import { MySqlContainer } from '@testcontainers/mysql';
import type { StartedMySqlContainer } from '@testcontainers/mysql';
import { escape, escapeId } from 'mysql2';
import { createConnection } from 'mysql2/promise';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { VerifyAuditChain } from '@/application/audit/services/verify-audit-chain';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import { AesGcmSecretEncryptor } from '@/infrastructure/auth/aes-gcm-secret-encryptor';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { KyselyAuditSink } from '@/infrastructure/database/audit/kysely-audit-sink';
import { KyselyAuditVerificationRepository } from '@/infrastructure/database/audit/kysely-audit-verification-repository';
import { createDatabaseClient } from '@/infrastructure/database/client';
import { createKyselyBudgetRepositories } from '@/infrastructure/database/budget/create-kysely-budget-repositories';
import { createKyselyMasterDataRepositories } from '@/infrastructure/database/master-data/create-kysely-master-data-repositories';
import { createMigrator } from '@/infrastructure/database/migrator';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { credentials } from './fixtures/auth';

const encryptionKey = Buffer.alloc(32, 11).toString('base64');
const hmacKey = Buffer.alloc(32, 12).toString('base64');

export default async function globalSetup() {
  const container = await new MySqlContainer('mysql:8.4.11')
    .withDatabase('fvdms_e2e')
    .withUsername('fvdms_e2e')
    .withUserPassword('fvdms-e2e-password')
    .withRootPassword('fvdms-e2e-root-password')
    .start();
  let server: ChildProcess | undefined;
  let worker: ChildProcess | undefined;

  try {
    await prepareDatabase(container);
    worker = startWorker(container);
    server = startServer(container);
    await waitForHealth(server);
  } catch (error) {
    server?.kill('SIGTERM');
    worker?.kill('SIGTERM');
    await container.stop();
    throw error;
  }

  return async () => {
    await Promise.all([stopProcess(server!), stopProcess(worker!)]);
    await container.stop();
  };
}

async function prepareDatabase(container: StartedMySqlContainer): Promise<void> {
  await prepareAuditSchemas(container);
  const database = createDatabaseClient({
    host: container.getHost(),
    port: container.getPort(),
    name: container.getDatabase(),
    user: container.getUsername(),
    password: container.getUserPassword(),
    poolMin: 0,
    poolMax: 4,
    connectTimeoutMs: 5_000,
    queryTimeoutMs: 2_000,
  });
  try {
    const migration = await createMigrator(database).migrateToLatest();
    if (migration.error) throw migration.error;
    const repositories = createKyselyAuthRepositories(database);
    let roles = await repositories.roles.list();
    const passwordHasher = new Argon2PasswordHasher();
    const publicIds = new UuidV7Generator();
    const now = new Date();
    const auditReaderRolePublicId = publicIds.generate().toString();
    const referenceManagerRolePublicId = publicIds.generate().toString();
    await repositories.roles.create({
      publicId: auditReaderRolePublicId,
      code: 'AUDIT_READER',
      name: 'Audit reader',
      isPrivileged: false,
      createdAt: now,
    });
    await repositories.roles.create({
      publicId: referenceManagerRolePublicId,
      code: 'REFERENCE_MANAGER',
      name: 'Reference data manager',
      isPrivileged: false,
      createdAt: now,
    });
    const permissions = await repositories.permissions.list();
    const auditRead = permissions.find((permission) => permission.code === 'audit.read')!;
    await repositories.permissions.replaceRolePermissions(
      auditReaderRolePublicId,
      [auditRead.publicId],
      now,
    );
    const referencePermissions = permissions.filter((permission) =>
      [
        'office.read',
        'office.manage',
        'driver.read',
        'driver.manage',
        'vehicle.read',
        'vehicle.manage',
      ].includes(permission.code),
    );
    await repositories.permissions.replaceRolePermissions(
      referenceManagerRolePublicId,
      referencePermissions.map((permission) => permission.publicId),
      now,
    );
    roles = await repositories.roles.list();
    const users = [
      {
        ...credentials.standard,
        email: 'dispatch.e2e@example.lan',
        name: 'Dispatch E2E',
        role: 'DISPATCH_OFFICER',
        mustChange: false,
      },
      {
        username: credentials.forced.username,
        password: credentials.forced.password,
        email: 'forced.e2e@example.lan',
        name: 'Forced Change E2E',
        role: 'VIEWER',
        mustChange: true,
      },
      {
        ...credentials.enrollment,
        email: 'enrollment.e2e@example.lan',
        name: 'Enrollment E2E',
        role: 'SYSTEM_ADMIN',
        mustChange: false,
      },
      {
        username: credentials.administrator.username,
        password: credentials.administrator.password,
        email: 'admin.e2e@example.lan',
        name: 'Administrator E2E',
        role: 'SUPER_ADMIN',
        mustChange: false,
      },
      {
        ...credentials.manager,
        email: 'reference.manager.e2e@example.lan',
        name: 'Reference Manager E2E',
        role: 'REFERENCE_MANAGER',
        mustChange: false,
      },
      {
        ...credentials.viewer,
        email: 'viewer.e2e@example.lan',
        name: 'Viewer E2E',
        role: 'VIEWER',
        mustChange: false,
      },
      {
        ...credentials.auditor,
        email: 'auditor.e2e@example.lan',
        name: 'Auditor E2E',
        role: 'AUDITOR',
        mustChange: false,
      },
      {
        ...credentials.auditReader,
        email: 'audit.reader.e2e@example.lan',
        name: 'Audit Reader E2E',
        role: 'AUDIT_READER',
        mustChange: false,
      },
      {
        ...credentials.budgetOfficer,
        email: 'budget.officer.e2e@example.lan',
        name: 'Budget Officer E2E',
        role: 'BUDGET_OFFICER',
        mustChange: false,
      },
      {
        ...credentials.psmd,
        email: 'psmd.e2e@example.lan',
        name: 'PSMD Staff E2E',
        role: 'PSMD_STAFF',
        mustChange: false,
      },
    ];
    const userPublicIds = new Map<string, string>();
    for (const input of users) {
      const publicId = publicIds.generate().toString();
      userPublicIds.set(input.username, publicId);
      await repositories.users.create({
        publicId,
        username: input.username,
        email: input.email,
        fullName: input.name,
        passwordHash: await passwordHasher.hash(input.password),
        mustChangePassword: input.mustChange,
        createdAt: now,
      });
      const role = roles.find((candidate) => candidate.code === input.role)!;
      await repositories.roles.replaceUserRoles(publicId, [role.publicId], now);
      if (input.username === credentials.administrator.username) {
        const factorPublicId = publicIds.generate().toString();
        const encryptor = new AesGcmSecretEncryptor({ 1: encryptionKey }, 1);
        await repositories.totpFactors.save({
          publicId: factorPublicId,
          userPublicId: publicId,
          status: 'ENABLED',
          encryptedSecret: encryptor.encrypt(
            credentials.administrator.secret,
            `${publicId}:${factorPublicId}`,
          ),
          lastUsedCounter: null,
          confirmedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const offices = await seedMasterData(
      database,
      userPublicIds.get(credentials.manager.username)!,
      publicIds,
      now,
    );
    await seedBudgetAllocations(
      database,
      offices,
      userPublicIds.get(credentials.budgetOfficer.username)!,
      publicIds,
      now,
    );
    await seedAuditEvidence(database, userPublicIds.get(credentials.auditor.username)!);
  } finally {
    await database.destroy();
  }
}

async function seedMasterData(
  database: ReturnType<typeof createDatabaseClient>,
  actorPublicId: string,
  publicIds: UuidV7Generator,
  createdAt: Date,
): Promise<readonly Office[]> {
  const repositories = createKyselyMasterDataRepositories(database);
  const actor = PublicId.from(actorPublicId);
  const deletedAt = new Date(createdAt.getTime() + 1_000);

  const offices = ['Operations Office', 'Budget Office', 'Archived Office'].map(
    (name, index) =>
      new Office({
        publicId: PublicId.from(publicIds.generate().toString()),
        name: OfficeName.from(name),
        abbreviation: OfficeAbbreviation.from(['OPS', 'BUD', 'ARC'][index]!),
        createdAt,
        updatedAt: createdAt,
      }),
  );
  const drivers = ['Alex Rivera', 'Casey Santos', 'Archived Driver'].map(
    (name, index) =>
      new Driver({
        publicId: PublicId.from(publicIds.generate().toString()),
        name: DriverName.from(name),
        contactNumber: DriverContactNumber.optional(`+63 917 000 10${index}`),
        createdAt,
        updatedAt: createdAt,
      }),
  );
  const vehicles = [
    ['Toyota Hilux', 'Pickup', 'FVD 101'],
    ['Isuzu N-Series', 'Truck', 'FVD 102'],
    ['Archived Van', 'Van', 'FVD 103'],
  ].map(
    ([modelBrand, vehicleType, plateNumber]) =>
      new Vehicle({
        publicId: PublicId.from(publicIds.generate().toString()),
        modelBrand: ModelBrand.from(modelBrand!),
        vehicleType: VehicleType.from(vehicleType!),
        plateNumber: PlateNumber.from(plateNumber!),
        remarks: VehicleRemarks.optional('Deterministic browser fixture'),
        createdAt,
        updatedAt: createdAt,
      }),
  );

  for (const office of offices) await repositories.offices.insert(office);
  for (const driver of drivers) await repositories.drivers.insert(driver);
  for (const vehicle of vehicles) await repositories.vehicles.insert(vehicle);

  offices[1]!.changeStatus(OfficeStatus.inactive(), deletedAt);
  await repositories.offices.updateStatus(offices[1]!);
  offices[2]!.softDelete({ at: deletedAt, actorPublicId: actor, reason: 'Archived test office' });
  drivers[2]!.softDelete({ at: deletedAt, actorPublicId: actor, reason: 'Archived test driver' });
  vehicles[2]!.softDelete({ at: deletedAt, actorPublicId: actor, reason: 'Archived test vehicle' });
  await repositories.offices.softDelete(offices[2]!);
  await repositories.drivers.softDelete(drivers[2]!);
  await repositories.vehicles.softDelete(vehicles[2]!);
  return offices;
}

async function seedBudgetAllocations(
  database: ReturnType<typeof createDatabaseClient>,
  offices: readonly Office[],
  actorPublicId: string,
  publicIds: UuidV7Generator,
  createdAt: Date,
): Promise<void> {
  const repository = createKyselyBudgetRepositories(database).allocations;
  const period = new ManilaFiscalPeriodPolicy().resolve(createdAt);
  const nextPeriod =
    period.quarter === 4
      ? { fiscalYear: period.fiscalYear + 1, quarter: 1 }
      : { fiscalYear: period.fiscalYear, quarter: period.quarter + 1 };
  const fixtures = [
    { ppmp: 'E2E-OPERATIONAL-CURRENT', status: 'ACTIVE', office: offices[0]!, period },
    { ppmp: 'E2E-DRAFT-CURRENT', status: 'DRAFT', office: offices[0]!, period },
    { ppmp: 'E2E-CLOSED-CURRENT', status: 'CLOSED', office: offices[0]!, period },
    { ppmp: 'E2E-CANCELLED-CURRENT', status: 'CANCELLED', office: offices[0]!, period },
    { ppmp: 'E2E-ACTIVE-FUTURE', status: 'ACTIVE', office: offices[0]!, period: nextPeriod },
    { ppmp: 'E2E-ACTIVE-INACTIVE-OFFICE', status: 'ACTIVE', office: offices[1]!, period },
  ] as const;

  for (const fixture of fixtures) {
    await repository.insert(
      new BudgetAllocation({
        publicId: PublicId.from(publicIds.generate().toString()),
        ppmpNumber: PpmpNumber.from(fixture.ppmp),
        officePublicId: fixture.office.publicId,
        quarter: Quarter.from(fixture.period.quarter),
        fiscalYear: FiscalYear.from(fixture.period.fiscalYear),
        status: BudgetAllocationStatus.from(fixture.status),
        createdAt,
        updatedAt: createdAt,
      }),
    );
  }

  const deleted = new BudgetAllocation({
    publicId: PublicId.from(publicIds.generate().toString()),
    ppmpNumber: PpmpNumber.from('E2E-DELETED-ACTIVE'),
    officePublicId: offices[0]!.publicId,
    quarter: Quarter.from(period.quarter),
    fiscalYear: FiscalYear.from(period.fiscalYear),
    status: BudgetAllocationStatus.from('ACTIVE'),
    createdAt,
    updatedAt: createdAt,
  });
  await repository.insert(deleted);
  deleted.softDelete({
    at: new Date(createdAt.getTime() + 2_000),
    actorPublicId: PublicId.from(actorPublicId),
    reason: 'Deleted budget allocation browser fixture',
  });
  await repository.softDelete(deleted);
}

async function prepareAuditSchemas(container: StartedMySqlContainer): Promise<void> {
  const administrator = await createConnection({
    host: container.getHost(),
    port: container.getPort(),
    user: 'root',
    password: 'fvdms-e2e-root-password',
    timezone: 'Z',
  });
  try {
    for (const schema of ['fvdms_audit', 'fvdms_audit_sink']) {
      await administrator.query(
        `CREATE DATABASE ${escapeId(schema)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
      await administrator.query(
        `GRANT ALL PRIVILEGES ON ${escapeId(schema)}.* TO ${escape(container.getUsername())}@'%'`,
      );
    }
  } finally {
    await administrator.end();
  }
}

async function seedAuditEvidence(
  database: ReturnType<typeof createDatabaseClient>,
  actorPublicId: string,
): Promise<void> {
  const capturedAt = new Date('2026-08-28T10:00:00.000Z');
  const publicIds = new UuidV7Generator();
  const transaction = new KyselyAuthTransaction(database);
  for (let index = 1; index <= 52; index += 1) {
    const event: AuditEventInput = {
      publicId: publicIds.generate().toString(),
      schemaVersion: 1,
      occurredAt: new Date(capturedAt.getTime() + index * 1_000).toISOString(),
      actorPublicId,
      action: 'audit.seed.recorded',
      entity: { type: 'audit_fixture', publicId: publicIds.generate().toString() },
      requestId: `audit-seed-request-${index}`,
      ipAddress: '192.0.2.50',
      userAgent: 'Audit E2E setup',
      reasonCode: null,
      before: null,
      after: { index },
      metadata: { index, safeMarkup: '<script>alert("not executable")</script>' },
    };
    await transaction.execute(({ auditEvents }) => auditEvents.append(event));
  }
  const repository = new KyselyAuditChainRepository(database, {
    primarySchema: 'fvdms_audit',
  });
  const hasher = new NodeSha256AuditHasher();
  await new AuditChainWorker({
    repository,
    canonicalizer: new Rfc8785AuditCanonicalizer(),
    hasher,
    clock: { now: () => new Date('2026-08-28T10:02:00.000Z') },
    policy: { batchSize: 100, maximumCanonicalPayloadBytes: 65_536 },
  }).runBatch();
  await new AuditSinkDeliveryWorker({
    repository,
    sink: new KyselyAuditSink(database, { sinkSchema: 'fvdms_audit_sink' }),
    hasher,
    clock: { now: () => new Date('2026-08-28T10:03:00.000Z') },
    random: () => 0,
    policy: { batchSize: 100, retryBaseMs: 1_000, retryMaxMs: 60_000 },
  }).runBatch();
  await new VerifyAuditChain({
    repository: new KyselyAuditVerificationRepository(database, database, {
      primarySchema: 'fvdms_audit',
      sinkSchema: 'fvdms_audit_sink',
    }),
    hasher,
    publicIds,
    clock: { now: () => new Date('2026-08-28T10:04:00.000Z') },
    pageSize: 20,
  }).execute();
}

function startServer(container: StartedMySqlContainer): ChildProcess {
  const environment = runtimeEnvironment(container);
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
    { cwd: process.cwd(), env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return child;
}

function startWorker(container: StartedMySqlContainer): ChildProcess {
  return spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/audit/worker.ts'], {
    cwd: process.cwd(),
    env: runtimeEnvironment(container),
    stdio: 'ignore',
  });
}

function runtimeEnvironment(container: StartedMySqlContainer): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    DATABASE_HOST: container.getHost(),
    DATABASE_PORT: String(container.getPort()),
    DATABASE_NAME: container.getDatabase(),
    DATABASE_USER: container.getUsername(),
    DATABASE_PASSWORD: container.getUserPassword(),
    DATABASE_POOL_MIN: '0',
    DATABASE_POOL_MAX: '8',
    DATABASE_CONNECT_TIMEOUT_MS: '5000',
    DATABASE_QUERY_TIMEOUT_MS: '2000',
    AUDIT_DATABASE_NAME: 'fvdms_audit',
    AUDIT_SINK_HOST: container.getHost(),
    AUDIT_SINK_PORT: String(container.getPort()),
    AUDIT_SINK_DATABASE_NAME: 'fvdms_audit_sink',
    AUDIT_WORKER_DATABASE_USER: container.getUsername(),
    AUDIT_WORKER_DATABASE_PASSWORD: container.getUserPassword(),
    AUDIT_SINK_DATABASE_USER: container.getUsername(),
    AUDIT_SINK_DATABASE_PASSWORD: container.getUserPassword(),
    AUDIT_VERIFIER_DATABASE_USER: container.getUsername(),
    AUDIT_VERIFIER_DATABASE_PASSWORD: container.getUserPassword(),
    AUDIT_POLL_INTERVAL_MS: '100',
    AUTH_ALLOWED_ORIGIN: 'http://localhost:3100',
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
    AUTH_TOTP_ENCRYPTION_KEYS: JSON.stringify({ 1: encryptionKey }),
    AUTH_RATE_LIMIT_HMAC_KEY: hmacKey,
  };
}

async function waitForHealth(server: ChildProcess): Promise<void> {
  let output = '';
  server.stdout?.on('data', (chunk) => {
    output += chunk.toString();
  });
  server.stderr?.on('data', (chunk) => {
    output += chunk.toString();
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null)
      throw new Error(`Next.js exited before E2E setup completed.\n${output}`);
    try {
      const response = await fetch('http://localhost:3100/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next.js did not become ready for E2E tests.\n${output}`);
}

async function stopProcess(processToStop: ChildProcess): Promise<void> {
  if (processToStop.exitCode !== null) return;
  processToStop.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => processToStop.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (processToStop.exitCode === null) processToStop.kill('SIGKILL');
}
