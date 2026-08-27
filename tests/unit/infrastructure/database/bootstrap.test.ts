import { describe, expect, it } from 'vitest';

import type { BootstrapEnvironment } from '@/infrastructure/config/environment';
import { createBootstrapStatements } from '@/infrastructure/database/bootstrap';

const environment: BootstrapEnvironment = {
  administrator: { host: 'mysql', port: 3306, user: 'root', password: '' },
  database: { name: 'fvdms' },
  application: { user: 'fvdms_app', password: 'application-password' },
  migration: { user: 'fvdms_migrator', password: 'migration-password' },
};

describe('database bootstrap statements', () => {
  it('creates the database and both least-privilege users idempotently', () => {
    const statements = createBootstrapStatements(environment);
    const sql = statements.join('\n');

    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS `fvdms`');
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_app'@'%'");
    expect(sql).toContain("CREATE USER IF NOT EXISTS 'fvdms_migrator'@'%'");
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
    expect(sql).toContain('GRANT CREATE, ALTER, DROP, INDEX, REFERENCES');
  });

  it('does not grant schema changes to the runtime application user', () => {
    const applicationGrant = createBootstrapStatements(environment).find(
      (statement) => statement.startsWith('GRANT') && statement.includes("'fvdms_app'"),
    );

    expect(applicationGrant).toBeDefined();
    expect(applicationGrant).not.toMatch(/\b(CREATE|ALTER|DROP)\b/);
  });
});
