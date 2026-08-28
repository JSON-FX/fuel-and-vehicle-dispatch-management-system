import { escape, escapeId } from 'mysql2';

import type { BootstrapEnvironment } from '@/infrastructure/config/environment';

function account(user: string): string {
  return `${escape(user)}@'%'`;
}

export function createBootstrapStatements(environment: BootstrapEnvironment): readonly string[] {
  const database = escapeId(environment.database.name);
  const primaryAuditSchema = escapeId(environment.audit.primarySchema);
  const sinkAuditSchema = escapeId(environment.audit.sinkSchema);
  const applicationAccount = account(environment.application.user);
  const migrationAccount = account(environment.migration.user);
  const workerAccount = account(environment.audit.worker.user);
  const sinkWriterAccount = account(environment.audit.sinkWriter.user);
  const verifierAccount = account(environment.audit.verifier.user);

  const identities = [
    [applicationAccount, environment.application.password],
    [migrationAccount, environment.migration.password],
    [workerAccount, environment.audit.worker.password],
    [sinkWriterAccount, environment.audit.sinkWriter.password],
    [verifierAccount, environment.audit.verifier.password],
  ] as const;

  return [
    `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    `CREATE DATABASE IF NOT EXISTS ${primaryAuditSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    `CREATE DATABASE IF NOT EXISTS ${sinkAuditSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    ...identities.flatMap(([identity, password]) => [
      `CREATE USER IF NOT EXISTS ${identity} IDENTIFIED BY ${escape(password)}`,
      `ALTER USER ${identity} IDENTIFIED BY ${escape(password)}`,
    ]),
    ...identities.map(([identity]) => `REVOKE ALL PRIVILEGES, GRANT OPTION FROM ${identity}`),
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO ${applicationAccount}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO ${migrationAccount}`,
    `GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON ${database}.* TO ${migrationAccount}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${primaryAuditSchema}.* TO ${migrationAccount}`,
    `GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON ${primaryAuditSchema}.* TO ${migrationAccount}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${sinkAuditSchema}.* TO ${migrationAccount}`,
    `GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON ${sinkAuditSchema}.* TO ${migrationAccount}`,
  ];
}

function table(schema: string, name: string): string {
  return `${escapeId(schema)}.${escapeId(name)}`;
}

export function createAuditRuntimeGrantStatements(
  environment: BootstrapEnvironment,
): readonly string[] {
  const primary = environment.audit.primarySchema;
  const sink = environment.audit.sinkSchema;
  const applicationAccount = account(environment.application.user);
  const workerAccount = account(environment.audit.worker.user);
  const sinkWriterAccount = account(environment.audit.sinkWriter.user);
  const verifierAccount = account(environment.audit.verifier.user);

  return [
    `GRANT INSERT ON ${table(primary, 'audit_outbox')} TO ${applicationAccount}`,
    `GRANT SELECT ON ${table(primary, 'audit_chain_entries')} TO ${applicationAccount}`,
    `GRANT SELECT ON ${table(primary, 'audit_verification_runs')} TO ${applicationAccount}`,
    `GRANT SELECT ON ${table(primary, 'audit_outbox')} TO ${workerAccount}`,
    `GRANT SELECT, INSERT ON ${table(primary, 'audit_chain_entries')} TO ${workerAccount}`,
    `GRANT SELECT, UPDATE ON ${table(primary, 'audit_chain_heads')} TO ${workerAccount}`,
    `GRANT SELECT, INSERT, UPDATE ON ${table(primary, 'audit_sink_deliveries')} TO ${workerAccount}`,
    `GRANT SELECT, INSERT ON ${table(sink, 'audit_sink_entries')} TO ${sinkWriterAccount}`,
    `GRANT SELECT ON ${table(primary, 'audit_chain_entries')} TO ${verifierAccount}`,
    `GRANT SELECT ON ${table(primary, 'audit_chain_heads')} TO ${verifierAccount}`,
    `GRANT INSERT ON ${table(primary, 'audit_verification_runs')} TO ${verifierAccount}`,
    `GRANT SELECT ON ${table(sink, 'audit_sink_entries')} TO ${verifierAccount}`,
  ];
}

export function requiredAuditTables(environment: BootstrapEnvironment): ReadonlySet<string> {
  return new Set([
    `${environment.audit.primarySchema}.audit_outbox`,
    `${environment.audit.primarySchema}.audit_chain_entries`,
    `${environment.audit.primarySchema}.audit_chain_heads`,
    `${environment.audit.primarySchema}.audit_sink_deliveries`,
    `${environment.audit.primarySchema}.audit_verification_runs`,
    `${environment.audit.sinkSchema}.audit_sink_entries`,
  ]);
}
