import { promises as fileSystem } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Kysely } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';

import type { Database } from '@/infrastructure/database/types';

const migrationFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export function createMigrator(database: Kysely<Database>): Migrator {
  return new Migrator({
    db: database,
    provider: new FileMigrationProvider({
      fs: fileSystem,
      path,
      migrationFolder,
    }),
    allowUnorderedMigrations: false,
  });
}
