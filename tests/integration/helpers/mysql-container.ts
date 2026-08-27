import { MySqlContainer } from '@testcontainers/mysql';

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

  project.provide('mysql', {
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getUserPassword(),
  });

  return async () => container.stop();
}
