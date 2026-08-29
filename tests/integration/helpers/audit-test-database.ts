import { sql, type Kysely } from 'kysely';
import { createConnection, createPool, type Pool } from 'mysql2/promise';

import type {
  BootstrapEnvironment,
  DatabaseEnvironment,
} from '@/infrastructure/config/environment';
import {
  createAuditRuntimeGrantStatements,
  createBootstrapStatements,
} from '@/infrastructure/database/bootstrap';
import { createDatabaseClient } from '@/infrastructure/database/client';
import type { Database } from '@/infrastructure/database/types';

import type { TestDatabaseConfiguration } from './test-database';

const credentials = {
  application: { user: 'fvdms_it_app', password: 'fvdms-it-application-password' },
  migration: { user: 'fvdms_it_migrator', password: 'fvdms-it-migration-password' },
  reporting: { user: 'fvdms_it_reporter', password: 'fvdms-it-reporter-password' },
  worker: { user: 'fvdms_it_audit_worker', password: 'fvdms-it-worker-password' },
  sinkWriter: { user: 'fvdms_it_sink_writer', password: 'fvdms-it-sink-password' },
  verifier: { user: 'fvdms_it_verifier', password: 'fvdms-it-verifier-password' },
} as const;

export interface AuditTestDatabase {
  readonly application: Kysely<Database>;
  readonly workerDatabase: Kysely<Database>;
  readonly sinkWriterDatabase: Kysely<Database>;
  readonly verifierPrimaryDatabase: Kysely<Database>;
  readonly verifierSinkDatabase: Kysely<Database>;
  readonly applicationRaw: Pool;
  readonly worker: Pool;
  readonly sinkWriter: Pool;
  readonly verifier: Pool;
  readonly close: () => Promise<void>;
}

export async function resetAuditEvidence(
  database: Kysely<Database>,
  updatedAt: Date = new Date(0),
): Promise<void> {
  await sql`delete from fvdms_audit.audit_verification_runs`.execute(database);
  await sql`delete from fvdms_audit_sink.audit_sink_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_sink_deliveries`.execute(database);
  await sql`delete from fvdms_audit.audit_chain_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`update fvdms_audit.audit_chain_heads
            set last_sequence = 0, last_source_position = 0,
                last_record_hash = ${Buffer.alloc(32)}, updated_at = ${updatedAt}
            where head_name = 'global'`.execute(database);
}

export async function createAuditTestDatabase(
  configuration: TestDatabaseConfiguration,
): Promise<AuditTestDatabase> {
  const environment: BootstrapEnvironment = {
    administrator: {
      host: configuration.host,
      port: configuration.port,
      user: configuration.administratorUser,
      password: configuration.administratorPassword,
    },
    database: { name: configuration.database },
    application: credentials.application,
    migration: credentials.migration,
    reporting: credentials.reporting,
    audit: {
      primarySchema: 'fvdms_audit',
      sinkSchema: 'fvdms_audit_sink',
      worker: credentials.worker,
      sinkWriter: credentials.sinkWriter,
      verifier: credentials.verifier,
    },
  };
  const administrator = await createConnection({
    host: configuration.host,
    port: configuration.port,
    user: configuration.administratorUser,
    password: configuration.administratorPassword,
    timezone: 'Z',
  });
  try {
    for (const statement of [
      ...createBootstrapStatements(environment),
      ...createAuditRuntimeGrantStatements(environment),
    ]) {
      await administrator.query(statement);
    }
  } finally {
    await administrator.end();
  }

  const pool = (identity: { readonly user: string; readonly password: string }, database: string) =>
    createPool({
      host: configuration.host,
      port: configuration.port,
      database,
      user: identity.user,
      password: identity.password,
      timezone: 'Z',
      connectionLimit: 2,
    });
  const applicationRaw = pool(credentials.application, configuration.database);
  const worker = pool(credentials.worker, 'fvdms_audit');
  const sinkWriter = pool(credentials.sinkWriter, 'fvdms_audit_sink');
  const verifier = pool(credentials.verifier, 'fvdms_audit');
  const applicationEnvironment: DatabaseEnvironment = {
    host: configuration.host,
    port: configuration.port,
    name: configuration.database,
    user: credentials.application.user,
    password: credentials.application.password,
    poolMin: 0,
    poolMax: 2,
    connectTimeoutMs: 5_000,
    queryTimeoutMs: 2_000,
  };
  const application = createDatabaseClient(applicationEnvironment);
  const databaseEnvironment = (
    identity: { readonly user: string; readonly password: string },
    name: string,
  ): DatabaseEnvironment => ({
    ...applicationEnvironment,
    name,
    user: identity.user,
    password: identity.password,
  });
  const workerDatabase = createDatabaseClient(
    databaseEnvironment(credentials.worker, 'fvdms_audit'),
  );
  const sinkWriterDatabase = createDatabaseClient(
    databaseEnvironment(credentials.sinkWriter, 'fvdms_audit_sink'),
  );
  const verifierPrimaryDatabase = createDatabaseClient(
    databaseEnvironment(credentials.verifier, 'fvdms_audit'),
  );
  const verifierSinkDatabase = createDatabaseClient(
    databaseEnvironment(credentials.verifier, 'fvdms_audit_sink'),
  );

  return {
    application,
    workerDatabase,
    sinkWriterDatabase,
    verifierPrimaryDatabase,
    verifierSinkDatabase,
    applicationRaw,
    worker,
    sinkWriter,
    verifier,
    close: async () => {
      await Promise.all([
        application.destroy(),
        workerDatabase.destroy(),
        sinkWriterDatabase.destroy(),
        verifierPrimaryDatabase.destroy(),
        verifierSinkDatabase.destroy(),
        applicationRaw.end(),
        worker.end(),
        sinkWriter.end(),
        verifier.end(),
      ]);
    },
  };
}
