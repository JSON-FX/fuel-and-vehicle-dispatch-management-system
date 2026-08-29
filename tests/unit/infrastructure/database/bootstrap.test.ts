import { describe, expect, it } from 'vitest';

import type { BootstrapEnvironment } from '@/infrastructure/config/environment';
import {
  createAuditRuntimeGrantStatements,
  createBootstrapStatements,
  createReportingRuntimeGrantStatements,
} from '@/infrastructure/database/bootstrap';

const environment: BootstrapEnvironment = {
  administrator: { host: 'mysql', port: 3306, user: 'root', password: '' },
  database: { name: 'fvdms' },
  application: { user: 'fvdms_app', password: 'application-password' },
  migration: { user: 'fvdms_migrator', password: 'migration-password' },
  reporting: { user: 'fvdms_reporter', password: 'reporter-password' },
  audit: {
    primarySchema: 'fvdms_audit',
    sinkSchema: 'fvdms_audit_sink',
    worker: { user: 'fvdms_audit_worker', password: 'audit-worker-password' },
    sinkWriter: { user: 'fvdms_audit_sink_writer', password: 'audit-sink-password' },
    verifier: { user: 'fvdms_audit_verifier', password: 'audit-verifier-password' },
  },
};

describe('database bootstrap statements', () => {
  it('creates all three databases and six least-privilege users idempotently', () => {
    const statements = createBootstrapStatements(environment);
    const sql = statements.join('\n');

    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS `fvdms`');
    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS `fvdms_audit`');
    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS `fvdms_audit_sink`');
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_app'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_migrator'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_reporter'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_audit_worker'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_audit_sink_writer'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_audit_verifier'@'%'");

    for (const user of [
      'fvdms_app',
      'fvdms_migrator',
      'fvdms_reporter',
      'fvdms_audit_worker',
      'fvdms_audit_sink_writer',
      'fvdms_audit_verifier',
    ]) {
      expect(sql).toContain(`ALTER USER '${user}'@'%' IDENTIFIED BY`);
      expect(sql).toContain(`REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${user}'@'%'`);
    }
  });

  it('grants the reporter read-only access to exact reporting source tables', () => {
    const statements = createReportingRuntimeGrantStatements(environment);

    expect(statements).toHaveLength(6);
    expect(statements).toEqual(
      expect.arrayContaining([
        "GRANT SELECT ON `fvdms`.`offices` TO 'fvdms_reporter'@'%'",
        "GRANT SELECT ON `fvdms`.`drivers` TO 'fvdms_reporter'@'%'",
        "GRANT SELECT ON `fvdms`.`vehicles` TO 'fvdms_reporter'@'%'",
        "GRANT SELECT ON `fvdms`.`budget_allocations` TO 'fvdms_reporter'@'%'",
        "GRANT SELECT ON `fvdms`.`fuel_issuances` TO 'fvdms_reporter'@'%'",
        "GRANT SELECT ON `fvdms`.`vehicle_dispatches` TO 'fvdms_reporter'@'%'",
      ]),
    );
    expect(statements.join('\n')).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REFERENCES)\b/,
    );
    expect(statements.join('\n')).not.toContain('export_jobs');
    expect(statements.join('\n')).not.toContain('audit_');
  });

  it('gives the migrator data and schema control without granting other accounts broad audit access', () => {
    const statements = createBootstrapStatements(environment);
    const migrationGrants = statements.filter(
      (statement) => statement.startsWith('GRANT') && statement.includes("'fvdms_migrator'"),
    );
    const otherAuditGrants = statements.filter(
      (statement) =>
        statement.startsWith('GRANT') &&
        !statement.includes("'fvdms_migrator'") &&
        /`fvdms_audit(?:_sink)?`\.\*/.test(statement),
    );

    expect(migrationGrants).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ON `fvdms`.*'),
        expect.stringContaining('ON `fvdms_audit`.*'),
        expect.stringContaining('ON `fvdms_audit_sink`.*'),
      ]),
    );
    expect(migrationGrants.join('\n')).toContain('CREATE, ALTER, DROP, INDEX, REFERENCES');
    expect(otherAuditGrants).toEqual([]);
  });

  it('grants exact table privileges after the migration creates audit tables', () => {
    const statements = createAuditRuntimeGrantStatements(environment);
    const sql = statements.join('\n');

    expect(sql).toContain("GRANT INSERT ON `fvdms_audit`.`audit_outbox` TO 'fvdms_app'@'%'");
    expect(sql).toContain("GRANT SELECT ON `fvdms_audit`.`audit_chain_entries` TO 'fvdms_app'@'%'");
    expect(sql).toContain(
      "GRANT SELECT ON `fvdms_audit`.`audit_verification_runs` TO 'fvdms_app'@'%'",
    );

    expect(sql).toContain(
      "GRANT SELECT ON `fvdms_audit`.`audit_outbox` TO 'fvdms_audit_worker'@'%'",
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT ON `fvdms_audit`.`audit_chain_entries` TO 'fvdms_audit_worker'@'%'",
    );
    expect(sql).toContain(
      "GRANT SELECT, UPDATE ON `fvdms_audit`.`audit_chain_heads` TO 'fvdms_audit_worker'@'%'",
    );
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON `fvdms_audit`.`audit_sink_deliveries` TO 'fvdms_audit_worker'@'%'",
    );

    expect(sql).toContain(
      "GRANT SELECT, INSERT ON `fvdms_audit_sink`.`audit_sink_entries` TO 'fvdms_audit_sink_writer'@'%'",
    );
    expect(sql).toContain(
      "GRANT SELECT ON `fvdms_audit`.`audit_chain_entries` TO 'fvdms_audit_verifier'@'%'",
    );
    expect(sql).toContain(
      "GRANT SELECT ON `fvdms_audit_sink`.`audit_sink_entries` TO 'fvdms_audit_verifier'@'%'",
    );
    expect(sql).toContain(
      "GRANT INSERT ON `fvdms_audit`.`audit_verification_runs` TO 'fvdms_audit_verifier'@'%'",
    );
  });

  it('never grants audit update, delete, or schema changes to the application or sink writer', () => {
    const sensitiveAccounts = ["'fvdms_app'@'%'", "'fvdms_audit_sink_writer'@'%'"];
    const grants = createAuditRuntimeGrantStatements(environment).filter((statement) =>
      sensitiveAccounts.some((account) => statement.includes(account)),
    );

    expect(grants).not.toEqual([]);
    expect(grants.join('\n')).not.toMatch(/\b(UPDATE|DELETE|CREATE|ALTER|DROP|REFERENCES)\b/);
  });
});
