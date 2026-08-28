import { spawn, type ChildProcess } from 'node:child_process';

import { MySqlContainer } from '@testcontainers/mysql';
import type { StartedMySqlContainer } from '@testcontainers/mysql';

import { AesGcmSecretEncryptor } from '@/infrastructure/auth/aes-gcm-secret-encryptor';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { createDatabaseClient } from '@/infrastructure/database/client';
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

  try {
    await prepareDatabase(container);
    server = startServer(container);
    await waitForHealth(server);
  } catch (error) {
    server?.kill('SIGTERM');
    await container.stop();
    throw error;
  }

  return async () => {
    await stopServer(server!);
    await container.stop();
  };
}

async function prepareDatabase(container: StartedMySqlContainer): Promise<void> {
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
    const roles = await repositories.roles.list();
    const passwordHasher = new Argon2PasswordHasher();
    const publicIds = new UuidV7Generator();
    const now = new Date();
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
        ...credentials.viewer,
        email: 'viewer.e2e@example.lan',
        name: 'Viewer E2E',
        role: 'VIEWER',
        mustChange: false,
      },
    ];
    for (const input of users) {
      const publicId = publicIds.generate().toString();
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
  } finally {
    await database.destroy();
  }
}

function startServer(container: StartedMySqlContainer): ChildProcess {
  const environment: NodeJS.ProcessEnv = {
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
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
    { cwd: process.cwd(), env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return child;
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

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolve) => server.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}
