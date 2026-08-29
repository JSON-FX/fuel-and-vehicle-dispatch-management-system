import { pathToFileURL } from 'node:url';

import { NO_MIGRATIONS, type Migrator } from 'kysely/migration';

import { getMigrationDatabase } from '@/infrastructure/database/client';
import { createMigrator } from '@/infrastructure/database/migrator';

const confirmationToken = 'FVDMS_FRESH_DATABASE';
const usage = `Usage: fresh --confirm ${confirmationToken}`;

export interface FreshArguments {
  readonly confirmed: true;
}

export interface FreshDatabaseResult {
  readonly rolledBack: number;
  readonly applied: number;
}

type FreshMigrator = Pick<Migrator, 'migrateTo' | 'migrateToLatest'>;

export function parseFreshArguments(arguments_: readonly string[]): FreshArguments {
  const normalized = arguments_[0] === '--' ? arguments_.slice(1) : arguments_;
  if (
    normalized.length !== 2 ||
    normalized[0] !== '--confirm' ||
    normalized[1] !== confirmationToken
  ) {
    throw new Error(usage);
  }
  return { confirmed: true };
}

export function assertFreshEnvironment(environment: string | undefined): void {
  if (environment === 'production') {
    throw new Error('Database refresh is disabled when NODE_ENV is production.');
  }
}

export async function freshDatabase(migrator: FreshMigrator): Promise<FreshDatabaseResult> {
  const rollback = await migrator.migrateTo(NO_MIGRATIONS);
  if (rollback.error) throw rollback.error;

  const apply = await migrator.migrateToLatest();
  if (apply.error) throw apply.error;

  return {
    rolledBack: successfulMigrations(rollback.results),
    applied: successfulMigrations(apply.results),
  };
}

function successfulMigrations(
  results: Awaited<ReturnType<Migrator['migrateTo']>>['results'],
): number {
  return results?.filter((migration) => migration.status === 'Success').length ?? 0;
}

async function main(): Promise<void> {
  parseFreshArguments(process.argv.slice(2));
  assertFreshEnvironment(process.env.NODE_ENV);

  const database = getMigrationDatabase();
  try {
    const result = await freshDatabase(createMigrator(database));
    console.info(`Rolled back ${result.rolledBack} migrations.`);
    console.info(`Applied ${result.applied} migrations.`);
    console.info('The database now contains only the latest baseline schema and reference data.');
  } finally {
    await database.destroy();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
