import { getMigrationDatabase } from '@/infrastructure/database/client';
import { createMigrator } from '@/infrastructure/database/migrator';

const database = getMigrationDatabase();

try {
  const migrations = await createMigrator(database).getMigrations();

  for (const migration of migrations) {
    const status = migration.executedAt ? 'executed' : 'pending';
    console.info(`${status}: ${migration.name}`);
  }
} finally {
  await database.destroy();
}
