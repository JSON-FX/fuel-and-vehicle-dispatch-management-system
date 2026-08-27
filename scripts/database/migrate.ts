import { getMigrationDatabase } from '@/infrastructure/database/client';
import { createMigrator } from '@/infrastructure/database/migrator';

const database = getMigrationDatabase();

try {
  const result = await createMigrator(database).migrateToLatest();

  if (result.error) {
    throw result.error;
  }

  for (const migration of result.results ?? []) {
    console.info(`${migration.status}: ${migration.migrationName} (${migration.direction})`);
  }
} finally {
  await database.destroy();
}
