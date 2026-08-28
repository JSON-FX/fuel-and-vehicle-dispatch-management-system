import { MySqlContainer } from '@testcontainers/mysql';
import { escape, escapeId } from 'mysql2';
import { createConnection } from 'mysql2/promise';

import type { TestDatabaseConfiguration } from './test-database';

interface GlobalSetupProject {
  provide(key: 'mysql', value: TestDatabaseConfiguration): void;
}

export default async function setup(project: GlobalSetupProject) {
  const container = await new MySqlContainer('mysql:8.4.11')
    .withDatabase('fvdms_test')
    .withUsername('fvdms_test')
    .withUserPassword('fvdms-test-password')
    .withRootPassword('fvdms-root-password')
    .start();

  const administrator = await createConnection({
    host: container.getHost(),
    port: container.getPort(),
    user: 'root',
    password: 'fvdms-root-password',
    timezone: 'Z',
  });

  try {
    for (const schema of ['fvdms_audit', 'fvdms_audit_sink']) {
      await administrator.query(
        `CREATE DATABASE IF NOT EXISTS ${escapeId(schema)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
      );
      await administrator.query(
        `GRANT ALL PRIVILEGES ON ${escapeId(schema)}.* TO ${escape(container.getUsername())}@'%'`,
      );
    }
  } finally {
    await administrator.end();
  }

  project.provide('mysql', {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getUserPassword(),
    administratorUser: 'root',
    administratorPassword: 'fvdms-root-password',
  });

  return async () => container.stop();
}
