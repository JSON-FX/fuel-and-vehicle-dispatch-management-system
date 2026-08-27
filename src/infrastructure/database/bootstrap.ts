import { escape, escapeId } from 'mysql2';

import type { BootstrapEnvironment } from '@/infrastructure/config/environment';

function account(user: string): string {
  return `${escape(user)}@'%'`;
}

export function createBootstrapStatements(environment: BootstrapEnvironment): readonly string[] {
  const database = escapeId(environment.database.name);
  const applicationAccount = account(environment.application.user);
  const migrationAccount = account(environment.migration.user);

  return [
    `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    `CREATE USER IF NOT EXISTS ${applicationAccount} IDENTIFIED BY ${escape(environment.application.password)}`,
    `ALTER USER ${applicationAccount} IDENTIFIED BY ${escape(environment.application.password)}`,
    `CREATE USER IF NOT EXISTS ${migrationAccount} IDENTIFIED BY ${escape(environment.migration.password)}`,
    `ALTER USER ${migrationAccount} IDENTIFIED BY ${escape(environment.migration.password)}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO ${applicationAccount}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO ${migrationAccount}`,
    `GRANT CREATE, ALTER, DROP, INDEX, REFERENCES ON ${database}.* TO ${migrationAccount}`,
  ];
}
